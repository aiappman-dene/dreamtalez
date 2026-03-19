function nextPage() {
  if (currentPage < pages.length - 1) {
    showPage(currentPage + 1);
  }
}

function prevPage() {
  if (currentPage > 0) {
    showPage(currentPage - 1);
  }
}
function showPage(index) {
  if (index < 0 || index >= pages.length) return;

  currentPage = index;

  document.getElementById("storyPage").innerText = pages[currentPage];
  document.getElementById("pageIndicator").innerText =
    `Page ${currentPage + 1} of ${pages.length}`;
}
function splitIntoPages(text) {
  const words = text.split(" ");
  const pageSize = 120; // words per page

  let result = [];

  for (let i = 0; i < words.length; i += pageSize) {
    result.push(words.slice(i, i + pageSize).join(" "));
  }

  return result;
}
let pages = [];
let currentPage = 0;
alert("JS LOADED");

function showHero() {
  const heroForm = document.getElementById("heroForm");
  const tonightForm = document.getElementById("tonightForm");
  const tabHero = document.getElementById("tabHero");
  const tabTonight = document.getElementById("tabTonight");

  heroForm.classList.remove("hidden");
  tonightForm.classList.add("hidden");
  tabHero.classList.add("active");
  tabTonight.classList.remove("active");
}

function showTonight() {
  const heroForm = document.getElementById("heroForm");
  const tonightForm = document.getElementById("tonightForm");
  const tabHero = document.getElementById("tabHero");
  const tabTonight = document.getElementById("tabTonight");

  tonightForm.classList.remove("hidden");
  heroForm.classList.add("hidden");
  tabTonight.classList.add("active");
  tabHero.classList.remove("active");
}

async function handleGenerate(mode) {
  const loadingMessage = document.getElementById("loadingMessage");
  const storyOutput = document.getElementById("storyOutput");
  const buttonId = mode === "hero" ? "generateHeroBtn" : "generateTonightBtn";
  const button = document.getElementById(buttonId);

  const payload =
    mode === "hero"
      ? {
          name: (document.getElementById("heroName").value || "").trim(),
          age: (document.getElementById("heroAge").value || "").trim(),
          idea: (document.getElementById("heroIdea").value || "").trim(),
          length: document.getElementById("heroLength").value
        }
      : {
          name: "Your Child",
          age: "5",
          idea: "a peaceful magical bedtime adventure",
          length: "short"
        };

  if (mode === "hero" && (!payload.name || !payload.age || !payload.idea)) {
    alert("Please fill in name, age, and idea.");
    return;
  }

  loadingMessage.classList.remove("hidden");
  storyOutput.innerText = "";
  button.disabled = true;

  const originalText = button.innerText;
  button.innerText = "Creating...";

  try {
    const response = await fetch("/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    // Paginate and display story
    pages = splitIntoPages(data.story || "No story was returned.");
    document.getElementById("storyContainer").classList.remove("hidden");
    showPage(0);
    document.getElementById("storyContainer").scrollIntoView({
      behavior: "smooth"
    });
  } catch (error) {
    console.error(error);
    storyOutput.innerText = "Something went wrong, please try again.";
  } finally {
    loadingMessage.classList.add("hidden");
    button.disabled = false;
    button.innerText = originalText;
  }
}
