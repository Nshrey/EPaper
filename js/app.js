// ===== 1. SETUP =====
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const btnA = document.getElementById("btnRegionA");
const btnB = document.getElementById("btnRegionB");
const datePicker = document.getElementById("datePicker");
const editionLine = document.getElementById("editionLine");
const emptyState = document.getElementById("emptyState");
const emptyText = document.getElementById("emptyText");
const prevDayBtn = document.getElementById("prevDayBtn");
const bookArea = document.getElementById("bookArea");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");
const thumbs = document.getElementById("thumbs");
const nav = document.getElementById("nav");

let currentRegion = "region-a"; // which region folder is selected
let currentRegionName = "Ambala"; // the name readers see
let book = null; // the flipbook currently on screen
let pageImages = []; // all page images, kept for zoom
let zoomPage = 0; // which page is zoomed
let zoomLevel = 1; // 1 = fit width, 2 = double, etc.

// ===== 2. DATE HELPERS =====
// Date -> "2026-10-24" (the format used in file names)
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

// "2026-10-24" -> Date
function parseDate(text) {
  const parts = text.split("-"); // ["2026", "10", "24"]
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// Date -> "Saturday, 24 October 2026" (the format readers see)
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function readableDate(d) {
  return DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}

// Date picker starts on today, and can't go into the future
datePicker.value = formatDate(new Date());
datePicker.max = datePicker.value;

// The date line under the masthead: "Ambala edition · Saturday, 24 October 2026"
function updateEditionLine() {
  editionLine.textContent = currentRegionName + " edition · " + readableDate(parseDate(datePicker.value));
}

// ===== 3. LOAD AN EDITION =====
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loaderFill");
const loaderText = document.getElementById("loaderText");

async function loadEdition() {
  const pdfPath = "editions/" + currentRegion + "/" + datePicker.value + ".pdf";
  clearBook();
  updateEditionLine();
  emptyState.hidden = true;
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
      showLoader((i - 1) / pdf.numPages, "Loading page " + i + " of " + pdf.numPages);
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
    emptyText.textContent =
      "There's no " + currentRegionName + " edition for " + readableDate(parseDate(datePicker.value)) + ".";
    emptyState.hidden = false;
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
  const viewport = page.getViewport({ scale: 1600 / base.width }); // ~1600px wide = sharp when zoomed
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
  nav.hidden = false;
  buildThumbs(images);
  book.on("flip", updatePageInfo);
  book.on("changeOrientation", updatePageInfo); // phone rotated, window resized
  updatePageInfo();
}

function clearBook() {
  if (book) {
    book.destroy();
    book = null;
  }
  bookArea.innerHTML = "";
  pageInfo.textContent = "";
  thumbs.innerHTML = "";
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  nav.hidden = true; // no paper, no page controls
}

function updatePageInfo() {
  const current = book.getCurrentPageIndex();
  const count = book.getPageCount();

  // On a laptop the book shows two pages side by side (except the front and back page)
  const twoPages = book.getOrientation() === "landscape" && current > 0 && current < count - 1;
  const lastVisible = twoPages ? current + 1 : current;

  pageInfo.textContent = twoPages
    ? "Pages " + (current + 1) + "–" + (lastVisible + 1) + " of " + count
    : "Page " + (current + 1) + " of " + count;

  // Dim the arrows when there's nowhere to go
  prevBtn.disabled = current === 0;
  nextBtn.disabled = lastVisible >= count - 1;

  thumbs.querySelectorAll(".thumb").forEach(function (t, i) {
    t.classList.toggle("active", i >= current && i <= lastVisible);
  });

  const active = thumbs.children[current];
  if (active)
    active.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
}

function buildThumbs(images) {
  thumbs.innerHTML = "";
  images.forEach(function (src, i) {
    const btn = document.createElement("button");
    btn.className = "thumb";
    btn.innerHTML = '<img src="' + src + '" alt=""><span>' + (i + 1) + "</span>";
    btn.addEventListener("click", function () {
      book.flip(i);
    });
    thumbs.appendChild(btn);
  });
}

// ===== 5. BUTTONS =====
function setRegion(region, button) {
  currentRegion = region;
  currentRegionName = button.textContent;
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
// On laptops, open the calendar wherever the button is clicked
datePicker.addEventListener("click", function () {
  try {
    datePicker.showPicker();
  } catch (e) {
    // older browsers: the normal date input still works
  }
});

// "Try the previous day": move the date back by one and load again
prevDayBtn.addEventListener("click", function () {
  const d = parseDate(datePicker.value);
  d.setDate(d.getDate() - 1);
  datePicker.value = formatDate(d);
  loadEdition();
});

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
  zoomInfo.textContent = "Page " + (zoomPage + 1) + " · " + Math.round(zoomLevel * 100) + "%";
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

// ===== 6. START: open today's edition for the first region =====
loadEdition();
