// ===== 1. SETUP =====
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const btnA = document.getElementById("btnRegionA");
const btnB = document.getElementById("btnRegionB");
const datePicker = document.getElementById("datePicker");
const message = document.getElementById("message");
const bookArea = document.getElementById("bookArea");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");
const thumbs = document.getElementById("thumbs");

let currentRegion = "region-a"; // which region is selected
let book = null; // the flipbook currently on screen
let pageImages = []; // all page images, kept for zoom
let zoomPage = 0; // which page is zoomed
let zoomLevel = 1; // 1 = fit width, 2 = double, etc.

// ===== 2. DATE HELPER (your code from before, as a reusable function) =====
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

// Date picker starts on today, and can't go into the future
datePicker.value = formatDate(new Date());
datePicker.max = datePicker.value;

// ===== 3. LOAD AN EDITION =====
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loaderFill");
const loaderText = document.getElementById("loaderText");

async function loadEdition() {
  const pdfPath = "editions/" + currentRegion + "/" + datePicker.value + ".pdf";
  clearBook();
  message.textContent = "";
  showLoader(0, "Opening paper…");

  try {
    const pdf = await pdfjsLib.getDocument({
      url: pdfPath,
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked: true,
    }).promise;

    const images = [];
    let pageWidth = 0,
      pageHeight = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      showLoader(
        (i - 1) / pdf.numPages,
        "Loading page " + i + " of " + pdf.numPages,
      );
      const result = await pageToImage(pdf, i);
      images.push(result.image);
      if (i === 1) {
        pageWidth = result.width;
        pageHeight = result.height;
      }
    }

    showBook(images, pageWidth, pageHeight);
  } catch (err) {
    console.error(err);
    message.textContent = "No edition found for this date. Try another date.";
  }

  loader.hidden = true; // hide the bar whether it worked or not
}

function showLoader(fraction, text) {
  loader.hidden = false;
  loaderFill.style.width = Math.round(fraction * 100) + "%";
  loaderText.textContent = text;
}
// Turns one PDF page into an image
async function pageToImage(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1200 / base.width }); // ~1200px wide = sharp
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({
    canvasContext: canvas.getContext("2d"),
    viewport: viewport,
  }).promise;
  return {
    image: canvas.toDataURL("image/jpeg", 0.85),
    width: base.width,
    height: base.height,
  };
}

// ===== 4. THE FLIPBOOK =====
function showBook(images, w, h) {
  pageImages = images;

  const el = document.createElement("div");
  bookArea.appendChild(el);

  book = new St.PageFlip(el, {
    width: 400,
    height: Math.round((400 * h) / w), // keeps the newspaper's shape
    size: "stretch", // fits the screen
    minWidth: 200,
    maxWidth: 1000,
    minHeight: 300,
    maxHeight: 1600,
    showCover: true, // front page shows alone
    usePortrait: true, // one page at a time on phones
    mobileScrollSupport: false,
  });

  book.loadFromImages(images);
  buildThumbs(images);
  book.on("flip", updatePageInfo);
  updatePageInfo();
}

function clearBook() {
  if (book) {
    book.destroy();
    book = null;
  }
  bookArea.innerHTML = "";
  pageInfo.textContent = "";
  thumbs.innerHTML = ""; // ← add
}

function updatePageInfo() {
  const current = book.getCurrentPageIndex();
  pageInfo.textContent = "Page " + (current + 1) + " of " + book.getPageCount();

  thumbs.querySelectorAll(".thumb").forEach(function (t, i) {
    t.classList.toggle("active", i === current);
  });

  const active = thumbs.children[current];
  if (active)
    active.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "smooth",
    });
}

// ===== 5. BUTTONS =====
function setRegion(region, button) {
  currentRegion = region;
  btnA.classList.remove("active");
  btnB.classList.remove("active");
  button.classList.add("active");
  loadEdition();
}

btnA.addEventListener("click", function () {
  setRegion("region-a", btnA);
});
btnB.addEventListener("click", function () {
  setRegion("region-b", btnB);
});
datePicker.addEventListener("change", loadEdition);
prevBtn.addEventListener("click", function () {
  if (book) book.flipPrev();
});
nextBtn.addEventListener("click", function () {
  if (book) book.flipNext();
});

// ===== ZOOM =====
const zoomView = document.getElementById("zoomView");
const zoomImg = document.getElementById("zoomImg");
const zoomInfo = document.getElementById("zoomInfo");
const zoomScroll = document.getElementById("zoomScroll");

function openZoom() {
  if (!book) return;
  zoomPage = book.getCurrentPageIndex();
  zoomLevel = 1;
  showZoomPage();
  zoomView.hidden = false;
}

function showZoomPage() {
  zoomImg.src = pageImages[zoomPage];
  zoomImg.style.width = zoomLevel * 100 + "%";
  zoomInfo.textContent =
    "Page " + (zoomPage + 1) + " · " + Math.round(zoomLevel * 100) + "%";
}

function changeZoom(step) {
  zoomLevel = Math.min(4, Math.max(1, zoomLevel + step)); // stays between 100% and 400%
  showZoomPage();
}

function moveZoomPage(step) {
  const next = zoomPage + step;
  if (next >= 0 && next < pageImages.length) {
    zoomPage = next;
    zoomScroll.scrollTo(0, 0);
    showZoomPage();
  }
}

function closeZoom() {
  zoomView.hidden = true;
  book.flip(zoomPage); // book jumps to the page you were reading
}

document.getElementById("zoomBtn").addEventListener("click", openZoom);
document.getElementById("zoomIn").addEventListener("click", function () {
  changeZoom(0.5);
});
document.getElementById("zoomOut").addEventListener("click", function () {
  changeZoom(-0.5);
});
document.getElementById("zoomPrev").addEventListener("click", function () {
  moveZoomPage(-1);
});
document.getElementById("zoomNext").addEventListener("click", function () {
  moveZoomPage(1);
});
document.getElementById("zoomClose").addEventListener("click", closeZoom);

// Keyboard: arrows work in both views, Esc closes zoom
document.addEventListener("keydown", function (e) {
  if (!book) return;
  if (!zoomView.hidden) {
    if (e.key === "ArrowLeft") moveZoomPage(-1);
    if (e.key === "ArrowRight") moveZoomPage(1);
    if (e.key === "Escape") closeZoom();
  } else {
    if (e.key === "ArrowLeft") book.flipPrev();
    if (e.key === "ArrowRight") book.flipNext();
  }
});
function buildThumbs(images) {
  thumbs.innerHTML = "";
  images.forEach(function (src, i) {
    const btn = document.createElement("button");
    btn.className = "thumb";
    btn.innerHTML =
      '<img src="' + src + '" alt=""><span>' + (i + 1) + "</span>";
    btn.addEventListener("click", function () {
      book.flip(i);
    });
    thumbs.appendChild(btn);
  });
}

// ===== 6. START: open today's edition for Region A =====
loadEdition();
