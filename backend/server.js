
require("dotenv").config();

const { MongoClient } = require("mongodb");
const express = require("express");
const cors = require("cors");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");


let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  serviceAccount = require("./firebase-service-account.json");
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}


const firebaseAuth = getAuth();

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
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Please log in to continue."
    });
  }

  const token = authHeader.slice(7);

  try {
const decodedToken = await firebaseAuth.verifyIdToken(token);
req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Your login session is invalid or expired. Please log in again."
    });
  }
}

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

 // Add a project
app.post("/api/projects", verifyFirebaseToken, async (req, res) => {
  const {
    title,
    description,
    category,
    technologies,
    github
  } = req.body;

  const createdBy =
    req.user.name || req.user.email || "ProjectHub User";

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
    )
  ) {
    return res.status(400).json({
      error: "Enter valid project details and a GitHub repository URL."
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
      ownerUid: req.user.uid,
      createdAt: new Date()
    };

    await projectsCollection.insertOne(project);

    res.status(201).json(project);
  } catch (error) {
    console.error("Add project error:", error);
    res.status(500).json({
      error: "Unable to save project."
    });
  }
});

 // Get the logged-in user's profile
app.get("/api/me/profile", verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    let profile = await profilesCollection.findOne({ uid });

    if (!profile) {
      profile = {
        uid,
        name: req.user.name || req.user.email || "ProjectHub User",
        bio: "",
        avatar: "👩🏻‍💻",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await profilesCollection.insertOne(profile);
    }

    const myProjects = await projectsCollection
      .find({ ownerUid: uid })
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
    console.error("Fetch own profile error:", error);
    res.status(500).json({ error: "Unable to fetch your profile." });
  }
});

// Update only the logged-in user's profile

app.put("/api/me/profile", verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { name, bio, avatar } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof bio !== "string" ||
      typeof avatar !== "string" ||
      !avatar.trim()
    ) {
      return res.status(400).json({
        error: "Enter a valid name, bio, and avatar."
      });
    }

    const result = await profilesCollection.findOneAndUpdate(
      { uid },
      {
        $set: {
          name: name.trim(),
          bio: bio.trim(),
          avatar: avatar.trim(),
          updatedAt: new Date()
        },
        $setOnInsert: {
          uid,
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
    console.error("Update own profile error:", error);
    res.status(500).json({
      error: "Unable to save your profile."
    });
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

app.put("/api/profiles/:name", (req, res) => {
  return res.status(410).json({
    error: "This profile endpoint is retired. Use /api/me/profile."
  });
});

// TEMPORARY: Link only confirmed projects to the logged-in account
app.post("/api/admin/link-my-projects", verifyFirebaseToken, async (req, res) => {
  try {
    const uid = req.user.uid;

    const result = await projectsCollection.updateMany(
      {
        id: { $in: [1, 3] },
        ownerUid: { $exists: false }
      },
      {
        $set: { ownerUid: uid }
      }
    );

    res.json({
      message: "Migration completed",
      linkedProjects: result.modifiedCount
    });
  } catch (error) {
    console.error("Project migration error:", error);
    res.status(500).json({ error: "Migration failed." });
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
