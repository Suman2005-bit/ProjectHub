
require("dotenv").config();

const { MongoClient } = require("mongodb");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  family: 4,
  serverSelectionTimeoutMS: 10000
});
let db;
let projectsCollection;
let profilesCollection;

// Connect to MongoDB Atlas
async function connectDB() {
  await client.connect();

  db = client.db("projecthub");
  projectsCollection = db.collection("projects");
  profilesCollection = db.collection("profiles");

  // Create unique indexes for reliable IDs and profile names
  await projectsCollection.createIndex(
    { id: 1 },
    { unique: true }
  );

  await profilesCollection.createIndex(
    { name: 1 },
    { unique: true }
  );

  console.log("Connected to MongoDB Atlas!");
}

// Home route
app.get("/", (req, res) => {
  res.send("Student Project Showcase API is running!");
});

// Get all projects
app.get("/api/projects", async (req, res) => {
  try {
    const projects = await projectsCollection
      .find({})
      .sort({ id: -1 })
      .toArray();

    res.json(projects);
  } catch (error) {
    console.error("Fetch projects error:", error);
    res.status(500).json({ error: "Unable to fetch projects." });
  }
});

// Docker health check
app.get("/health", (req, res) => {
  res.json({
    status: db ? "healthy" : "starting",
    database: db ? "connected" : "connecting"
  });
});



// Add a project
app.post("/api/projects", async (req, res) => {
  const {
    title,
    description,
    category,
    technologies,
    github,
    createdBy
  } = req.body;

  if (
    typeof title !== "string" || !title.trim() ||
    typeof description !== "string" || !description.trim() ||
    typeof category !== "string" || !category.trim() ||
    !Array.isArray(technologies) ||
    technologies.length === 0 ||
    !technologies.every(
      t => typeof t === "string" && t.trim()
    ) ||
    typeof github !== "string" ||
    !/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(
      github.trim()
    ) ||
    typeof createdBy !== "string" ||
    !createdBy.trim()
  ) {
    return res.status(400).json({
      error: "Enter valid project details, owner name, and a GitHub repository URL."
    });
  }

  try {
    const lastProject = await projectsCollection
      .find({})
      .sort({ id: -1 })
      .limit(1)
      .toArray();

    const project = {
      id: lastProject.length ? lastProject[0].id + 1 : 1,
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      technologies: technologies.map(t => t.trim()),
      github: github.trim(),
      createdBy: createdBy.trim(),
      createdAt: new Date()
    };

    await projectsCollection.insertOne(project);

    res.status(201).json(project);
  } catch (error) {
    console.error("Add project error:", error);
    res.status(500).json({ error: "Unable to save project." });
  }
});

// Get or create a profile
app.get("/api/profiles/:name", async (req, res) => {
  try {
    const name = req.params.name.trim();

    if (!name) {
      return res.status(400).json({ error: "Profile name is required." });
    }

    let profile = await profilesCollection.findOne({ name });

    if (!profile) {
      profile = {
        name,
        bio: "",
        avatar: "👩🏻‍💻",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await profilesCollection.insertOne(profile);
    }

    const myProjects = await projectsCollection
      .find({ createdBy: name })
      .toArray();

    const technologies = new Set(
      myProjects.flatMap(project => project.technologies || [])
    );

    const categories = new Set(
      myProjects.map(project => project.category).filter(Boolean)
    );

    res.json({
      ...profile,
      stats: {
        projects: myProjects.length,
        technologies: technologies.size,
        categories: categories.size
      }
    });
  } catch (error) {
    console.error("Fetch profile error:", error);
    res.status(500).json({ error: "Unable to fetch profile." });
  }
});

// Update a profile
app.put("/api/profiles/:name", async (req, res) => {
  try {
    const name = req.params.name.trim();
    const { bio, avatar } = req.body;

    if (
      typeof bio !== "string" ||
      typeof avatar !== "string" ||
      !avatar.trim()
    ) {
      return res.status(400).json({
        error: "Enter a valid bio and avatar."
      });
    }

    const result = await profilesCollection.findOneAndUpdate(
      { name },
      {
        $set: {
          bio: bio.trim(),
          avatar: avatar.trim(),
          updatedAt: new Date()
        },
        $setOnInsert: {
          name,
          createdAt: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    );

    res.json(result);
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Unable to save profile." });
  }
});

// Start only after MongoDB connects
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();
