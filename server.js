const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const app = express();
const PORT = 3030;

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory session store
const sessionTokenToSession = new Map();

// Data file paths
const dataDir = path.join(__dirname, 'data');
const facultyDataPath = path.join(dataDir, 'faculty.json');
const subjectsDataPath = path.join(dataDir, 'subjects.json');

// Ensure data files exist
function ensureFile(filePath, initialContent) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(initialContent, null, 2));
  }
}

ensureFile(facultyDataPath, { faculty: [] });
ensureFile(subjectsDataPath, { byFacultyId: {} });

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function requireAuth(req, res, next) {
  const token = req.cookies.session;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const session = sessionTokenToSession.get(token);
  if (!session) return res.status(401).json({ error: 'Invalid session' });
  req.session = session;
  return next();
}

// Auth routes
app.post('/coursefile/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const data = readJson(facultyDataPath);
  const faculty = (data.faculty || []).find(
    (f) => f.email.toLowerCase() === String(email).toLowerCase()
  );
  if (!faculty) return res.status(401).json({ error: 'Invalid credentials' });

  // Password is their faculty id per requirements
  const isValid = String(password) === String(faculty.facultyid);
  if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = uuidv4();
  const session = {
    token,
    facultyid: faculty.facultyid,
    email: faculty.email,
    name: faculty.name,
    department: faculty.department,
    academicYear: null,
    createdAt: Date.now()
  };
  sessionTokenToSession.set(token, session);
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax'
  });
  return res.json({ ok: true, user: { name: session.name, facultyid: session.facultyid, department: session.department } });
});

app.post('/coursefile/api/logout', requireAuth, (req, res) => {
  const token = req.cookies.session;
  sessionTokenToSession.delete(token);
  res.clearCookie('session');
  res.json({ ok: true });
});

app.post('/coursefile/api/year', requireAuth, (req, res) => {
  const { year } = req.body || {};
  // Expect format YYYY-YY e.g., 2023-24
  const regex = /^\d{4}-\d{2}$/;
  if (!year || !regex.test(year)) {
    return res.status(400).json({ error: 'Academic year must be in format YYYY-YY (e.g., 2023-24)' });
  }
  req.session.academicYear = year;
  return res.json({ ok: true, year });
});

app.get('/coursefile/api/me', requireAuth, (req, res) => {
  const { name, facultyid, email, department, academicYear } = req.session;
  res.json({ user: { name, facultyid, email, department }, academicYear: academicYear || null });
});

// Subjects CRUD
app.get('/coursefile/api/subjects', requireAuth, (req, res) => {
  const data = readJson(subjectsDataPath);
  const list = data.byFacultyId[req.session.facultyid] || [];
  res.json({ subjects: list });
});

app.post('/coursefile/api/subjects', requireAuth, (req, res) => {
  const { yearSem, department, section, subjectCode, subjectName, regulation } = req.body || {};
  if (!yearSem || !department || !section || !subjectCode || !subjectName || !regulation) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const data = readJson(subjectsDataPath);
  const subject = {
    id: uuidv4(),
    yearSem,
    department,
    section,
    subjectCode,
    subjectName,
    regulation,
    createdAt: Date.now()
  };
  if (!data.byFacultyId[req.session.facultyid]) {
    data.byFacultyId[req.session.facultyid] = [];
  }
  data.byFacultyId[req.session.facultyid].push(subject);
  writeJson(subjectsDataPath, data);
  res.status(201).json({ subject });
});

app.put('/coursefile/api/subjects/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { yearSem, department, section, subjectCode, subjectName, regulation } = req.body || {};
  const data = readJson(subjectsDataPath);
  const list = data.byFacultyId[req.session.facultyid] || [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Subject not found' });
  const existing = list[idx];
  const updated = {
    ...existing,
    yearSem: yearSem || existing.yearSem,
    department: department || existing.department,
    section: section || existing.section,
    subjectCode: subjectCode || existing.subjectCode,
    subjectName: subjectName || existing.subjectName,
    regulation: regulation || existing.regulation
  };
  list[idx] = updated;
  data.byFacultyId[req.session.facultyid] = list;
  writeJson(subjectsDataPath, data);
  res.json({ subject: updated });
});

app.delete('/coursefile/api/subjects/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const data = readJson(subjectsDataPath);
  const list = data.byFacultyId[req.session.facultyid] || [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Subject not found' });
  const removed = list[idx];
  const next = list.filter((s) => s.id !== id);
  data.byFacultyId[req.session.facultyid] = next;
  writeJson(subjectsDataPath, data);

  // Also delete uploaded files directory for this subject (current AY/Dept/Faculty)
  try {
    const year = req.session.academicYear;
    const dept = req.session.department;
    const facultyid = req.session.facultyid;
    if (year && dept && facultyid && removed && removed.subjectCode) {
      const dir = path.join(__dirname, 'uploads', year, dept, facultyid, removed.subjectCode);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  } catch (_) {
    // Ignore cleanup errors; core delete succeeded
  }

  res.json({ ok: true });
});

// Section names in order (23)
const SECTION_NAMES = [
  'Academic Calendar',
  'Test Schedules',
  'List of Holidays',
  'Subject Allocation',
  'IndividualClass Time Table',
  'List of Registered Students',
  'Course Syllabus along with Text Books and References',
  'Micro-Level Lesson Plan including Topics Planned Beyond Syllabus and Tutorials',
  'Unit-Wise Handouts',
  'Unit-Wise Lecture notes',
  'Content of Topics Beyond the Syllabus',
  'Tutorial Scripts',
  'Question Bank',
  'Previous Question papers of Sem End Examination',
  'Internal Evaluation 1',
  'Internal Evaluation 2',
  'Overall Internal Evaluation Marks',
  'Semester End Examination Question Paper',
  'Result Analysis',
  'Innovative Methods Employed in Teaching learning Process',
  'Record of Attendance and Assessment',
  'Student Feedback Report',
  'Record of Attainment of Course Outcomes'
];

// Multer storage setup per request
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (!req.session || !req.session.academicYear) {
        return cb(new Error('Academic year not set'));
      }
      const { subjectCode, section } = req.query;
      if (!subjectCode || !section) {
        return cb(new Error('subjectCode and section query params are required'));
      }
      const year = req.session.academicYear;
      const dept = req.session.department;
      const facultyid = req.session.facultyid;
      const baseDir = path.join(__dirname, 'uploads', year, dept, facultyid, subjectCode);
      fs.mkdirSync(baseDir, { recursive: true });
      cb(null, baseDir);
    },
    filename: (req, file, cb) => {
      // Save to a unique temporary filename; we'll post-process to add cover and rename
      cb(null, `${uuidv4()}.pdf`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Helper: split text into up to two lines that fit max width
function wrapTextToTwoLines(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/);
  let line1 = '';
  let line2 = '';
  for (const word of words) {
    const test = line1 ? line1 + ' ' + word : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line1 = test;
    } else {
      // move to second line
      const test2 = line2 ? line2 + ' ' + word : word;
      if (font.widthOfTextAtSize(test2, size) <= maxWidth) {
        line2 = test2;
      } else {
        // hard cut: append ellipsis to second line
        const ellipsis = '…';
        let truncated = test2;
        while (truncated.length && font.widthOfTextAtSize(truncated + ellipsis, size) > maxWidth) {
          truncated = truncated.slice(0, -1);
        }
        line2 = truncated + ellipsis;
      }
    }
  }
  return line2 ? [line1, line2] : [line1];
}

// Helper to add a simple white cover page with centered title
async function addCoverAndSave(tempFilePath, finalFilePath, title) {
  const rawBytes = fs.readFileSync(tempFilePath);
  const rawPdf = await PDFDocument.load(rawBytes);
  const outPdf = await PDFDocument.create();

  // Cover page
  const page = outPdf.addPage([595.28, 841.89]); // A4 portrait in points
  const font = await outPdf.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 24;
  const margin = 64;
  const maxWidth = page.getWidth() - margin * 2;
  const lines = wrapTextToTwoLines(title, font, fontSize, maxWidth);
  const lineHeight = fontSize * 1.3;
  const blockHeight = lines.length * lineHeight;
  let y = (page.getHeight() + blockHeight) / 2 - lineHeight; // center block vertically
  for (const line of lines) {
    const w = font.widthOfTextAtSize(line, fontSize);
    const x = (page.getWidth() - w) / 2;
    page.drawText(line, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= lineHeight;
  }

  // Append all pages from rawPdf
  const copied = await outPdf.copyPages(rawPdf, rawPdf.getPageIndices());
  copied.forEach((p) => outPdf.addPage(p));

  const bytes = await outPdf.save();
  fs.writeFileSync(finalFilePath, bytes);
}

// Upload single pdf for a given section
app.post('/coursefile/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { subjectCode, section } = req.query;
    if (!subjectCode || !section) return res.status(400).json({ error: 'subjectCode and section are required' });
    const year = req.session.academicYear;
    const dept = req.session.department;
    const facultyid = req.session.facultyid;
    const dir = path.join(__dirname, 'uploads', year, dept, facultyid, subjectCode);
    const finalName = `section-${section}.pdf`;
    const tmpPath = path.join(dir, req.file.filename);
    const finalPath = path.join(dir, finalName);
    const sectionIndex = Math.max(1, Math.min(23, Number(section)));
    const sectionTitle = SECTION_NAMES[sectionIndex - 1] || `Section ${sectionIndex}`;
    await addCoverAndSave(tmpPath, finalPath, sectionTitle);
    fs.unlinkSync(tmpPath);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Upload processing failed' });
  }
});

// Delete uploaded pdf for a given section
app.delete('/coursefile/api/upload', requireAuth, async (req, res) => {
  try {
    const { subjectCode, section } = req.query;
    if (!subjectCode || !section) return res.status(400).json({ error: 'subjectCode and section are required' });
    const year = req.session.academicYear;
    const dept = req.session.department;
    const facultyid = req.session.facultyid;
    const dir = path.join(__dirname, 'uploads', year, dept, facultyid, subjectCode);
    const filePath = path.join(dir, `section-${section}.pdf`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    fs.unlinkSync(filePath);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Delete failed' });
  }
});

// List uploaded files for a subject
app.get('/coursefile/api/uploads', requireAuth, (req, res) => {
  const { subjectCode } = req.query;
  if (!subjectCode) return res.status(400).json({ error: 'subjectCode is required' });
  if (!req.session.academicYear) return res.status(400).json({ error: 'Academic year not set' });
  const year = req.session.academicYear;
  const dept = req.session.department;
  const facultyid = req.session.facultyid;
  const dir = path.join(__dirname, 'uploads', year, dept, facultyid, subjectCode);
  if (!fs.existsSync(dir)) return res.json({ files: [] });
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((name) => ({
      name,
      url: `/coursefile/uploads/${encodeURIComponent(year)}/${encodeURIComponent(dept)}/${encodeURIComponent(facultyid)}/${encodeURIComponent(subjectCode)}/${encodeURIComponent(name)}`
    }));
  res.json({ files });
});

// Expose uploads for viewing (read-only)
app.use('/coursefile/uploads', (req, res, next) => {
  // Prevent path traversal; serve only within uploads dir
  const requested = path.normalize(req.path).replace(/^\/+/, '');
  const base = path.join(__dirname, 'uploads');
  const full = path.join(base, requested);
  if (!full.startsWith(base)) return res.status(400).end();
  if (!fs.existsSync(full)) return res.status(404).end();
  res.sendFile(full);
});

// Helper: add a white cover page with centered text to an existing PDFDocument
async function addCoverPageTo(outPdf, text) {
  const page = outPdf.addPage([595.28, 841.89]); // A4 portrait
  const font = await outPdf.embedFont(StandardFonts.HelveticaBold);
  const size = 20;
  const margin = 64;
  const maxWidth = page.getWidth() - margin * 2;
  const lines = wrapTextToTwoLines(text, font, size, maxWidth);
  const lineHeight = size * 1.3;
  const blockHeight = lines.length * lineHeight;
  let y = (page.getHeight() + blockHeight) / 2 - lineHeight;
  for (const line of lines) {
    const w = font.widthOfTextAtSize(line, size);
    const x = (page.getWidth() - w) / 2;
    page.drawText(line, { x, y, size, font, color: rgb(0, 0, 0) });
    y -= lineHeight;
  }
}

// Merge all available section PDFs into one file with a title page
app.get('/coursefile/api/merge', requireAuth, async (req, res) => {
  try {
    const { subjectCode, subjectName } = req.query;
    if (!subjectCode || !subjectName) return res.status(400).json({ error: 'subjectCode and subjectName are required' });
    const year = req.session.academicYear;
    const dept = req.session.department;
    const facultyid = req.session.facultyid;
    const dir = path.join(__dirname, 'uploads', year, dept, facultyid, subjectCode);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const out = await PDFDocument.create();
    // Title page for entire merged doc
    await addCoverPageTo(out, `${subjectCode} — ${subjectName}`);

    for (let i = 1; i <= 23; i++) {
      const filePath = path.join(dir, `section-${i}.pdf`);
      if (!fs.existsSync(filePath)) continue;
      const bytes = fs.readFileSync(filePath);
      const doc = await PDFDocument.load(bytes);
      // Each uploaded section PDF already includes its own cover page
      const copied = await out.copyPages(doc, doc.getPageIndices());
      copied.forEach((p) => out.addPage(p));
    }

    const mergedBytes = await out.save();
    const mergedPath = path.join(dir, 'merged.pdf');
    fs.writeFileSync(mergedPath, mergedBytes);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${subjectCode}-merged.pdf"`);
    return res.send(Buffer.from(mergedBytes));
  } catch (e) {
    return res.status(500).json({ error: 'Failed to merge PDFs' });
  }
});

// Redirect root to coursefile
app.get('/', (req, res) => {
  res.redirect('/coursefile');
});

// Fallback to serve SPA-like navigation between static pages
app.get('/coursefile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/coursefile/year', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'year.html'));
});
app.get('/coursefile/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/coursefile/coursework', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coursework.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


