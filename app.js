
function saveBedtime(){
  const time=document.getElementById("bedtimeTime").value;
  if(!time){
    alert("Please choose a bedtime");
    return;
  }
  localStorage.setItem("bedtimeReminder",time);
  alert("Bedtime reminder saved for "+time);
}
function setDedication(text){
  document.getElementById("dedication").value = text;
}
function updateGuide(){
  const name = document.getElementById("heroName").value || "your child";
  document.getElementById("storyGuideText").innerText =
    `You decide the adventure for ${name}. Choose an idea below or write your own.`;
}
function showHero(){
  document.getElementById("heroForm").classList.remove("hidden");
  document.getElementById("tonightForm").classList.add("hidden");
}

function showTonight(){
  document.getElementById("heroForm").classList.add("hidden");
  document.getElementById("tonightForm").classList.remove("hidden");
}

function setIdea(text){
  document.getElementById("heroIdea").value = text;
}

let currentStory = "";

async function generateStory(){
  const name=document.getElementById("heroName").value;
  const age=document.getElementById("heroAge").value;
  const idea=document.getElementById("heroIdea").value;
  const length=document.getElementById("heroLength").value;

  const loading=document.getElementById("loading");
  const storyBox=document.getElementById("story");
  const controls=document.getElementById("controls");

  loading.classList.remove("hidden");
  storyBox.innerHTML="";
  controls.classList.add("hidden");

  try{
    const response=await fetch("/story",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name,age,idea,length})
    });
    const data=await response.json();

    currentStory = data.story;

    const dedication = document.getElementById("dedication").value || "With love ❤️";
    storyBox.innerHTML = `
      <p class="dedication">This story is for ${name}, ${dedication}</p>
      <img src="${data.image}" style="width:100%;border-radius:10px;margin-bottom:20px;">
      <p>${data.story}</p>
    `;

    controls.classList.remove("hidden");
  }catch(error){
    storyBox.innerText="Something went wrong generating the story.";
  }

  loading.classList.add("hidden");
}

async function generateTonight(){
  // Try to use heroName/heroAge if visible, else fallback
  let name = "your child";
  let age = "5";
  if (!document.getElementById("heroForm").classList.contains("hidden")) {
    name = document.getElementById("heroName").value || name;
    age = document.getElementById("heroAge").value || age;
  }

  const idea = "a peaceful magical bedtime adventure";
  const length = "medium";

  const loading=document.getElementById("loading");
  const storyBox=document.getElementById("story");

  loading.classList.remove("hidden");
  storyBox.innerHTML="";

  try{
    const response = await fetch("/story",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        name,
        age,
        idea,
        length
      })
    });

    const data = await response.json();

    storyBox.innerHTML = `
      <img src="${data.image}" style="width:100%;border-radius:10px;margin-bottom:20px;">
      <p>${data.story}</p>
    `;

  }catch(error){
    storyBox.innerText="Could not generate tonight's story.";
  }

  loading.classList.add("hidden");
}

// READ STORY OUT LOUD
function readStory(){
  const speech = new SpeechSynthesisUtterance(currentStory);
  speech.rate = 0.9;
  speech.pitch = 1;
  speech.volume = 1;
  window.speechSynthesis.speak(speech);
}

// SAVE STORY
function saveStory(){
  let stories = JSON.parse(localStorage.getItem("savedStories") || "[]");
  stories.push(currentStory);
  localStorage.setItem("savedStories", JSON.stringify(stories));
  alert("Story saved ⭐");
}
