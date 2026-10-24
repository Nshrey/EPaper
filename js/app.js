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

let currentRegion = "region-a"; // which region is selected
let book = null; // the flipbook currently on screen

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
async function loadEdition() {
  const pdfPath = "editions/" + currentRegion + "/" + datePicker.value + ".pdf";
  clearBook();
  message.textContent = "Loading…";

  try {
    const pdf = await pdfjsLib.getDocument({
      url: pdfPath,
      // helps PDF.js show Hindi and other non-English fonts correctly
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
      cMapPacked: true,
    }).promise;

    const images = [];
    let pageWidth = 0,
      pageHeight = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      message.textContent = "Loading page " + i + " of " + pdf.numPages + "…";
      const result = await pageToImage(pdf, i);
      images.push(result.image);
      if (i === 1) {
        pageWidth = result.width;
        pageHeight = result.height;
      }
    }

    showBook(images, pageWidth, pageHeight);
    message.textContent = "";
  } catch (err) {
    console.error(err);
    message.textContent = "No edition found for this date. Try another date.";
  }
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
}

function updatePageInfo() {
  pageInfo.textContent =
    "Page " + (book.getCurrentPageIndex() + 1) + " of " + book.getPageCount();
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

document.addEventListener("keydown", function (e) {
  if (!book) return;
  if (e.key === "ArrowLeft") book.flipPrev();
  if (e.key === "ArrowRight") book.flipNext();
});

// ===== 6. START: open today's edition for Region A =====
loadEdition();
