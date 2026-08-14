import { Router } from "express";

const router = Router();

// Static resume-derived data served as JSON — lets the frontend (and any
// crawler hitting the API) get structured profile data from one source of truth.
const profile = {
  name: "Aryan Kaushik",
  title: "Full-Stack Developer",
  credentials: ["Certified Ethical Hacker (CEH)", "IIT Bombay Certified"],
  location: "India",
  email: "aryankaushik541@gmail.com",
  phone: "+91-7482860774",
  links: {
    github: "https://github.com/Aryankaushik541",
    linkedin: "https://www.linkedin.com/in/aryan-kaushik-811a99207",
  },
  summary:
    "Full-Stack Developer with 3+ years of experience building production-grade web applications. Skilled in React.js, Node.js, Express.js, MongoDB, and Python. Certified Ethical Hacker (CEH) with hands-on expertise in JWT authentication and RBAC.",
  skills: {
    languages: ["JavaScript (ES6+)", "Python", "TypeScript", "C++", "Java", "PHP"],
    frontend: ["React.js", "React Native", "Angular.js", "HTML5", "CSS3", "Tailwind CSS", "Redux", "Context API"],
    backend: ["Node.js", "Express.js", "Django", "Django REST Framework", "PHP", "REST API", "Microservices"],
    databases: ["MongoDB", "MySQL", "PostgreSQL", "SQLite"],
    security: ["JWT", "RBAC", "bcrypt", "CSRF Protection", "Cloudflare", "Penetration Testing", "Vulnerability Assessment"],
    tools: ["Git", "Docker", "Postman", "Linux", "CI/CD", "OpenAI API", "Agile", "Scrum"],
  },
  experience: [
    {
      role: "Android Development Intern",
      org: "Gowox Infotech Pvt. Ltd.",
      period: "Dec 2022 - Jan 2023",
      points: [
        "Developed 2 production Android applications using Java and Android Studio.",
        "Reduced rendering latency by approximately 25%.",
        "Delivered all sprint milestones on schedule in an Agile SDLC environment.",
      ],
    },
    {
      role: "Website Development & Database Management Intern",
      org: "Gowox Infotech Pvt. Ltd.",
      period: "Apr 2022 - May 2022",
      points: [
        "Built 3 responsive websites using HTML5, CSS3, and JavaScript.",
        "Designed MySQL databases with 5+ schemas.",
        "Implemented PHP backend services, improving data retrieval performance by ~30%.",
      ],
    },
    {
      role: "PLC & SCADA Industrial Automation Training",
      org: "SOFCON India Pvt. Ltd.",
      period: "Jul 2023 - Aug 2023",
      points: [
        "Gained hands-on experience with PLC programming and ladder logic design.",
        "Configured SCADA systems for industrial automation.",
      ],
    },
  ],
  projects: [
    {
      name: "Pharmaceutical Management System",
      stack: ["React Native", "Node.js", "MongoDB", "JWT", "RBAC"],
      points: [
        "Engineered a production pharma operations platform with 9-role RBAC authentication.",
        "Built real-time dashboards and medicine inventory tracking.",
        "Managed sales distribution for 50+ product SKUs.",
      ],
    },
    {
      name: "SaathiShaadi Matrimonial Platform",
      stack: ["React.js", "Node.js", "Express.js", "MongoDB Atlas"],
      url: "https://sathisadi.com",
      points: [
        "Deployed a production application (sathisadi.com).",
        "Built a database-backed admin panel managing rate limiting, OTP, and JWT expiry.",
        "Resolved CORS blocking in production.",
      ],
    },
    {
      name: "MERN Portfolio - Enterprise Security",
      stack: ["React.js", "Node.js", "MongoDB", "Cloudflare", "bcrypt"],
      points: [
        "Implemented DDoS protection and Cloudflare CDN.",
        "Added JWT/HS512 authentication and 2-step email OTP.",
        "Applied bcrypt hashing and CSRF protection across 9 MongoDB models.",
      ],
    },
    {
      name: "White Beat AI Platform",
      stack: ["React.js", "Django", "OpenAI API", "REST API"],
      points: [
        "Integrated OpenAI API for intelligent automation.",
        "Built an admin monitoring panel with interaction history.",
        "Added async fallback handling for API rate limits.",
      ],
    },
  ],
  education: [
    { degree: "B.Tech, Computer Science & Engineering", school: "MAKAUT", period: "Jan 2023 - Jan 2026" },
    { degree: "Diploma, Computer Science", school: "Government Polytechnic", period: "Jan 2020 - Jan 2023", note: "CGPA: 7.5/10" },
    { degree: "Matriculation (CBSE)", school: "G.D Mission Public School, Dhokra", note: "70%" },
  ],
  certifications: [
    "Certified Ethical Hacker (CEH), Ficklem — Valid: Jan 2021 - Jan 2026",
    "IIT Bombay: CSS, C++, Python, PHP & MySQL",
    "Virtual Platforms: React.js, Node.js, Angular.js",
    "Cisco Networking Academy: IT Essentials, Networking Essentials",
    "Android Development (Gowox Infotech); PLC & SCADA - NSDC (SOFCON India)",
  ],
};

router.get("/", (req, res) => {
  res.json({ ok: true, profile });
});

export default router;
