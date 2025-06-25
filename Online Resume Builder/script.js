const form = document.getElementById("resumeForm");
const fields = ["name", "email", "phone", "summary", "education", "experience", "skills"];
const fontSelect = document.getElementById("fontSelect");
const colorTheme = document.getElementById("colorTheme");
const profilePicInput = document.getElementById("profilePic");

// Preview elements
const preview = {
  name: document.getElementById("pName"),
  contact: document.getElementById("pContact"),
  summary: document.getElementById("pSummary"),
  education: document.getElementById("pEducation"),
  experience: document.getElementById("pExperience"),
  skills: document.getElementById("pSkills"),
  image: document.getElementById("pImage")
};

// Load & preview
window.onload = () => {
  fields.forEach(id => {
    const el = document.getElementById(id);
    const saved = localStorage.getItem(id);
    if (saved) {
      el.value = saved;
      updatePreview(id, saved);
    }
    el.addEventListener("input", () => {
      localStorage.setItem(id, el.value);
      updatePreview(id, el.value);
    });
  });

  fontSelect.value = localStorage.getItem("font") || "helvetica";
  colorTheme.value = localStorage.getItem("color") || "#00c8ff";
  fontSelect.addEventListener("input", () => localStorage.setItem("font", fontSelect.value));
  colorTheme.addEventListener("input", () => localStorage.setItem("color", colorTheme.value));
};

// Update preview panel
function updatePreview(id, val) {
  if (id === "name") preview.name.textContent = val || "Your Name";
  if (id === "email" || id === "phone") {
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;
    preview.contact.textContent = `${email} | ${phone}`;
  }
  if (id === "summary") preview.summary.textContent = val;
  if (id === "education") preview.education.textContent = val;
  if (id === "experience") preview.experience.textContent = val;
  if (id === "skills") preview.skills.textContent = val;
}

// Show image preview
profilePicInput.addEventListener("change", () => {
  const file = profilePicInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    preview.image.src = reader.result;
    preview.image.hidden = false;
  };
  reader.readAsDataURL(file);
});

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 10;

  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const phone = document.getElementById("phone").value;
  const summary = document.getElementById("summary").value;
  const education = document.getElementById("education").value;
  const experience = document.getElementById("experience").value;
  const skills = document.getElementById("skills").value;

  const font = fontSelect.value;
  const color = colorTheme.value;

  doc.setFont(font, "bold");
  doc.setFontSize(18);
  doc.setTextColor(color);
  doc.text(name, 10, y); y += 10;

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont(font, "normal");
  doc.text(`${email} | ${phone}`, 10, y); y += 10;

  const file = profilePicInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function () {
      const imgData = reader.result;
      doc.addImage(imgData, "JPEG", 150, 10, 40, 40);
      generatePDFContent();
    };
    reader.readAsDataURL(file);
  } else {
    generatePDFContent();
  }

  function generatePDFContent() {
    y = 60;
    doc.setFont(font, "bold");
    doc.text("Summary", 10, y); y += 7;
    doc.setFont(font, "normal");
    doc.text(doc.splitTextToSize(summary, 180), 10, y); y += summary.length / 2;

    doc.setFont(font, "bold");
    doc.text("Education", 10, y); y += 7;
    doc.setFont(font, "normal");
    doc.text(doc.splitTextToSize(education, 180), 10, y); y += education.length / 2;

    doc.setFont(font, "bold");
    doc.text("Experience", 10, y); y += 7;
    doc.setFont(font, "normal");
    doc.text(doc.splitTextToSize(experience, 180), 10, y); y += experience.length / 2;

    doc.setFont(font, "bold");
    doc.text("Skills", 10, y); y += 7;
    doc.setFont(font, "normal");
    doc.text(doc.splitTextToSize(skills, 180), 10, y);

    doc.save("MyResume.pdf");
  }
});
