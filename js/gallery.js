/* ============================================================
   BULLETIN + NOTICES GALLERIES — each pulls from its own public
   Google Drive folder and renders inline into its own grid.

   Layout-shift fix: as soon as we know how many files are in the
   folder (one fast metadata-only request), we paint that many
   fixed-size placeholder cards immediately. Images then fade into
   their already-sized slot as they finish downloading. PDFs are
   unaffected — the iframe viewer already has a fixed height and is
   inserted straight into its reserved slot, so nothing changes
   about how PDFs load or behave.
   ============================================================ */

const DRIVE_CONFIG = {
  API_KEY: 'AIzaSyDrPlwlZADTG3n5uIF0Q6wVJhazwG59m9s',
  BULLETIN_LIVE_FOLDER_ID: '1I5UMXbBOnQOu9rrA8BswfbhUSoV3w1hr',
  // ⚠️ Run setup() in the Apps Script (after pasting the updated Code.gs)
  // then replace this with the "Notices Live Folder" ID it logs out.
  NOTICE_LIVE_FOLDER_ID: '16_joiA8XA1sIs_gQPEKNQfHmr-Z-23kc',
};

document.addEventListener('DOMContentLoaded', () => {
  // Assumed counts: painted instantly, before the Drive metadata request
  // has even gone out, so there's a reserved slot on screen from the very
  // first frame. Once the real count comes back it replaces this guess —
  // if the guess was too high/low that one swap still causes a shift, but
  // it's usually right and removes the "starts at zero" jump entirely.
  loadGallery('galleryGrid', DRIVE_CONFIG.BULLETIN_LIVE_FOLDER_ID, 'bulletins', 1);
  loadGallery('noticesGrid', DRIVE_CONFIG.NOTICE_LIVE_FOLDER_ID, 'notices', 2);
});

async function loadGallery(gridId, folderId, label, assumedCount = 0) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  if (!DRIVE_CONFIG.API_KEY || DRIVE_CONFIG.API_KEY.startsWith('REPLACE_') || !folderId || folderId.startsWith('REPLACE_')) {
    grid.innerHTML = `<div class="gallery-empty">${label} gallery isn't connected yet — add the Drive API key and folder ID in <code>js/gallery.js</code>.</div>`;
    return;
  }

  // PHASE 0 — fill in the assumed number of generic placeholders right
  // away, before we even know real counts or types. Type is unknown at
  // this point so we default to an image-style skeleton (the common
  // case); it's swapped for the real, correctly-typed placeholder as
  // soon as the metadata request below resolves.
  if (assumedCount > 0) {
    grid.innerHTML = Array.from({ length: assumedCount }, (_, i) => renderGuessPlaceholder(i)).join('');
  }

  try {
    // imageMediaMetadata(width,height) lets image placeholders match the
    // real photo's proportions instead of a generic guess.
    const fields = 'files(id,name,mimeType,thumbnailLink,webViewLink,createdTime,imageMediaMetadata(width,height))';
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=createdTime&key=${DRIVE_CONFIG.API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Drive API responded ${res.status}`);
    const data = await res.json();
    const files = data.files || [];

    if (files.length === 0) {
      grid.innerHTML = `<div class="gallery-empty">No ${label} uploaded yet. Once one is emailed in, it will appear here automatically.</div>`;
      return;
    }

    // PHASE 1 — we already know the count and type of every file from the
    // metadata response above, so paint the final-sized grid right now,
    // before any image bytes or PDF previews have actually loaded.
    grid.innerHTML = files.map((file, i) => renderPlaceholder(file, i)).join('');

    // PHASE 2 — hydrate each slot. Images fade in once loaded; PDFs get
    // their iframe inserted straight away (their box size never changes).
    files.forEach((file, i) => hydrateCard(file, i, grid));
  } catch (err) {
    console.error(`Could not load ${label} gallery:`, err);
    grid.innerHTML = `<div class="gallery-empty">${label} couldn't be loaded right now. Please check back shortly.</div>`;
  }
}

function renderGuessPlaceholder(i) {
  return `
    <div class="gallery-card inline-viewer" data-idx="${i}">
      <div class="gallery-body gallery-skeleton" style="aspect-ratio:210/297;"></div>
    </div>`;
}

function renderPlaceholder(file, i) {
  const isImage = file.mimeType && file.mimeType.startsWith('image/');
  const meta = file.imageMediaMetadata;
  const ratio = isImage && meta && meta.width && meta.height ? `${meta.width}/${meta.height}` : '210/297';

  // PDFs: the iframe viewer is a fixed 600px tall regardless of content,
  // so its slot is simply that height — no skeleton shimmer needed since
  // nothing about its size will change once inserted.
  const bodyStyle = isImage ? `aspect-ratio:${ratio};` : `height:600px;`;
  const shimmerClass = isImage ? 'gallery-skeleton' : '';

  return `
    <div class="gallery-card inline-viewer" data-idx="${i}">
      <div class="gallery-body ${shimmerClass}" style="${bodyStyle}"></div>
    </div>`;
}

function hydrateCard(file, i, grid) {
  const card = grid.querySelector(`.gallery-card[data-idx="${i}"] .gallery-body`);
  if (!card) return;

  const isImage = file.mimeType && file.mimeType.startsWith('image/');

  if (isImage) {
    const src = `https://lh3.googleusercontent.com/d/${file.id}`;
    const img = new Image();
    img.alt = 'Bulletin';
    img.style.cssText = 'width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity .35s ease;';
    img.onload = () => {
      card.classList.remove('gallery-skeleton');
      card.appendChild(img);
      requestAnimationFrame(() => { img.style.opacity = '1'; });
    };
    img.onerror = () => {
      card.classList.remove('gallery-skeleton');
      card.innerHTML = '<div class="gallery-empty">Couldn\'t load image</div>';
    };
    img.src = src;
  } else {
    // Notice the '/preview' URL format for Google Drive PDFs — unchanged
    // from before. The card's height was already reserved in Phase 1, so
    // inserting the iframe now causes no layout shift.
    const embedUrl = `https://drive.google.com/file/d/${file.id}/preview`;
    card.innerHTML = `<iframe src="${embedUrl}" style="width:100%; height:100%; border:none;" title="Bulletin PDF Viewer"></iframe>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
