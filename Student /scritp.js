let students = JSON.parse(localStorage.getItem('students')) || [];

const form = document.getElementById('studentForm');
const table = document.querySelector('#studentTable tbody');

function saveAndRender() {
  localStorage.setItem('students', JSON.stringify(students));
  renderTable();
}

function renderTable() {
  table.innerHTML = '';
  students.forEach((student, index) => {
    let row = table.insertRow();
    row.innerHTML = `
      <td>${student.id}</td>
      <td>${student.name}</td>
      <td>${student.course}</td>
      <td>${student.age}</td>
      <td>
        <button onclick="editStudent(${index})">✏️</button>
        <button class="delete-btn" onclick="deleteStudent(${index})">🗑️</button>
      </td>
    `;
  });
}

function deleteStudent(index) {
  if (confirm("Are you sure you want to delete this student?")) {
    students.splice(index, 1);
    saveAndRender();
  }
}

function editStudent(index) {
  const s = students[index];
  document.getElementById('id').value = s.id;
  document.getElementById('name').value = s.name;
  document.getElementById('course').value = s.course;
  document.getElementById('age').value = s.age;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = form.id.value.trim();
  const name = form.name.value.trim();
  const course = form.course.value.trim();
  const age = form.age.value.trim();

  const existingIndex = students.findIndex(s => s.id === id);
  if (existingIndex !== -1) {
    students[existingIndex] = { id, name, course, age };
  } else {
    students.push({ id, name, course, age });
  }

  form.reset();
  saveAndRender();
});

renderTable();
