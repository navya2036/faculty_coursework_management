# Faculty Management System

A web-based faculty portal for **Shri Vishnu Engineering College for Women** that allows faculty members to manage their coursework documentation and academic materials.

## Features

- **Faculty Authentication**: Secure login using email and faculty ID
- **Academic Year Management**: Set and manage academic years (YYYY-YY format)
- **Subject Management**: Add, edit, and delete subjects with course details
- **Document Upload**: Upload PDF files for 23 different coursework sections
- **PDF Processing**: Automatic cover page generation for uploaded documents
- **Document Merging**: Combine all section PDFs into a single merged document
- **File Management**: View, download, and delete uploaded files

## Project Structure

```
faculty/
├── data/                   # JSON data files
│   ├── faculty.json       # Faculty member information
│   └── subjects.json      # Subject data by faculty
├── public/                # Frontend files
│   ├── index.html         # Login page
│   ├── dashboard.html     # Main dashboard
│   ├── coursework.html    # Coursework management
│   ├── year.html          # Academic year selection
│   └── styles.css         # Stylesheet
├── server/                # Backend server
│   └── index.js          # Express.js server
├── uploads/              # Uploaded PDF files (excluded from git)
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd faculty
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Login Credentials

Use the following credentials to login:

| Faculty Name    | Email                | Password (Faculty ID) | Department |
| --------------- | -------------------- | --------------------- | ---------- |
| Dr. Anitha Rao  | anitha.rao@svcew.edu | FAC1001               | CSE        |
| Prof. Suma Devi | suma.devi@svcew.edu  | FAC2002               | AIDS       |

## Coursework Sections

The system supports 23 different coursework sections:

1. Academic Calendar
2. Test Schedules
3. List of Holidays
4. Subject Allocation
5. Individual Class Time Table
6. List of Registered Students
7. Course Syllabus along with Text Books and References
8. Micro-Level Lesson Plan including Topics Planned Beyond Syllabus and Tutorials
9. Unit-Wise Handouts
10. Unit-Wise Lecture notes
11. Content of Topics Beyond the Syllabus
12. Tutorial Scripts
13. Question Bank
14. Previous Question papers of Sem End Examination
15. Internal Evaluation 1
16. Internal Evaluation 2
17. Overall Internal Evaluation Marks
18. Semester End Examination Question Paper
19. Result Analysis
20. Innovative Methods Employed in Teaching learning Process
21. Record of Attendance and Assessment
22. Student Feedback Report
23. Record of Attainment of Course Outcomes

## Technologies Used

- **Backend**: Node.js, Express.js
- **File Processing**: PDF-lib (for PDF manipulation)
- **File Upload**: Multer
- **Authentication**: Cookie-based sessions
- **Data Storage**: JSON files
- **Frontend**: Vanilla HTML, CSS, JavaScript

## API Endpoints

### Authentication

- `POST /api/login` - Faculty login
- `POST /api/logout` - Faculty logout
- `GET /api/me` - Get current user info

### Academic Year

- `POST /api/year` - Set academic year

### Subjects

- `GET /api/subjects` - Get faculty subjects
- `POST /api/subjects` - Create new subject
- `PUT /api/subjects/:id` - Update subject
- `DELETE /api/subjects/:id` - Delete subject

### File Management

- `POST /api/upload` - Upload PDF file
- `DELETE /api/upload` - Delete uploaded file
- `GET /api/uploads` - List uploaded files
- `GET /api/merge` - Generate merged PDF

## Configuration

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Development

To run in development mode:

```bash
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the ISC License.

---

**Shri Vishnu Engineering College for Women**  
Department of Artificial Intelligence & Data Science
