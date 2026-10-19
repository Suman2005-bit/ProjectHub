
const API_BASE_URL = window.PROJECTHUB_API_URL || "http://localhost:5000";

const API_URL = `${API_BASE_URL}/api/projects`;

const grid = document.getElementById("projectGrid");
const search = document.getElementById("search");
const category = document.getElementById("category");
const form = document.getElementById("projectForm");
const emptyMessage = document.getElementById("emptyMessage");
const message = document.getElementById("formMessage");

let projects = [];


async function loadProjects() {
  grid.innerHTML = '<p class="loading-state">Loading projects...</p>';

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error("Could not load projects");
    }

    projects = await response.json();

    updateCategories();
    renderProjects();
    updateProfileDashboard();
  } catch (error) {
    console.error(error);
    grid.innerHTML =
      '<p class="loading-state">Could not connect to the backend. Make sure it is running on port 5000.</p>';
  }
}


function updateCategories() {
  const selectedCategory = category.value;
  const selectedTechnology =
    document.getElementById("technologyFilter").value;

  const categories = [
    ...new Set(projects.map(p => p.category).filter(Boolean))
  ].sort();

  const technologies = [
    ...new Set(
      projects.flatMap(p => p.technologies || [])
        .filter(Boolean)
        .map(t => t.trim())
    )
  ].sort();

  category.innerHTML = '<option value="all">All categories</option>';
  technologies.forEach(name => {
    // Technology options are populated separately below.
  });

  categories.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    category.appendChild(option);
  });

  const technologyFilter = document.getElementById("technologyFilter");
  technologyFilter.innerHTML =
    '<option value="all">All technologies</option>';

  technologies.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    technologyFilter.appendChild(option);
  });

  category.value = categories.includes(selectedCategory)
    ? selectedCategory
    : "all";

  technologyFilter.value = technologies.includes(selectedTechnology)
    ? selectedTechnology
    : "all";
}

function renderProjects() {
  
const query = search.value.toLowerCase().trim();
const selectedCategory = category.value;
const selectedTechnology =
  document.getElementById("technologyFilter").value;
const sortBy = document.getElementById("sortBy").value;

  const filtered = projects.filter(project => {
    const searchable = [
      project.title,
      project.description,
      project.category,
      ...(project.technologies || [])
    ].join(" ").toLowerCase();

   return searchable.includes(query) &&
  (selectedCategory === "all" ||
    project.category === selectedCategory) &&
  (selectedTechnology === "all" ||
    (project.technologies || []).some(
      tech => String(tech).trim() === selectedTechnology
    ));
  });
  
filtered.sort((a, b) => {
  if (sortBy === "title") {
    return (a.title || "").localeCompare(b.title || "");
  }

  if (sortBy === "category") {
    return (a.category || "").localeCompare(b.category || "");
  }

  // Newest first: use the ID as a fallback
  return (b.id || 0) - (a.id || 0);
});


  document.getElementById("projectCount").textContent = projects.length;

  const technologies = new Set(
    projects.flatMap(p => p.technologies || [])
  );
  document.getElementById("technologyCount").textContent =
    technologies.size;

  document.getElementById("categoryCount").textContent =
    new Set(projects.map(p => p.category).filter(Boolean)).size;

  document.getElementById("resultCount").textContent =
    `${filtered.length} project${filtered.length === 1 ? "" : "s"} found`;

  grid.innerHTML = "";

  filtered.forEach(project => {
    const card = document.createElement("article");
    card.className = "project-card";

    const top = document.createElement("div");
    top.className = "card-top";

    const tag = document.createElement("span");
    tag.className = "category-tag";
    tag.textContent = project.category || "Uncategorized";

    const id = document.createElement("span");
    id.className = "project-id";
    id.textContent = `#${project.id ?? ""}`;

    top.append(tag, id);

    const title = document.createElement("h3");
    title.textContent = project.title;

    const description = document.createElement("p");
    description.textContent = project.description;

    const tags = document.createElement("div");
    tags.className = "tags";

    (project.technologies || []).forEach(technology => {
      const tech = document.createElement("span");
      tech.className = "tech-tag";
      tech.textContent = technology;
      tags.appendChild(tech);
    });

    const link = document.createElement("a");
    link.className = "card-link";
    link.href = project.github;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View repository ↗";


const detailsButton = document.createElement("button");
detailsButton.type = "button";
detailsButton.className = "details-btn";
detailsButton.textContent = "View details →";

detailsButton.addEventListener("click", () => {
  openProjectDetails(project);
});

card.append(top, title, description, tags, detailsButton, link);
    grid.appendChild(card);
  });

  emptyMessage.classList.toggle("hidden", filtered.length !== 0);
  grid.classList.toggle("hidden", filtered.length === 0);
}

search.addEventListener("input", renderProjects);
category.addEventListener("change", renderProjects);
document.getElementById("sortBy")
  .addEventListener("change", renderProjects);
  document.getElementById("technologyFilter")
  .addEventListener("change", renderProjects);

document.getElementById("openForm").addEventListener("click", () => {
  form.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "center" });
});

function closeForm() {
  form.reset();
  form.classList.add("hidden");
  message.textContent = "";
}

document.getElementById("cancelForm").addEventListener("click", closeForm);
document.getElementById("cancelFormBottom").addEventListener("click", closeForm);

form.addEventListener("submit", async event => {
  event.preventDefault();
  message.textContent = "Adding project...";

  const project = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    technologies: document.getElementById("technologies").value
      .split(",").map(t => t.trim()).filter(Boolean),
    category: document.getElementById("categoryInput").value.trim(),
    github: document.getElementById("github").value.trim()
  };

  
try {
  const projectWithOwner = {
    ...project,
    createdBy: getSavedProfile().name
  };

 
const token = await window.projectHubAuth.getIdToken();

const response = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify(projectWithOwner)
});

const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || "Unable to add project");
}

  projects.push(data);
  updateCategories();
  renderProjects();
  updateProfileDashboard();
  closeForm();
} catch (error) {
  console.error(error);
  message.textContent = error.message;
}
});


document.getElementById("refreshProjects")
  .addEventListener("click", loadProjects);

document.getElementById("clearFilters").addEventListener("click", () => {
  search.value = "";
  category.value = "all";
  document.getElementById("technologyFilter").value = "all";
  renderProjects();
});

document.querySelectorAll(".quick-link").forEach(button => {
  button.addEventListener("click", () => {
    const chosenCategory = button.dataset.category;
    const optionExists = [...category.options].some(
      option => option.value === chosenCategory
    );

    category.value = optionExists ? chosenCategory : "all";
    search.value = "";
    renderProjects();

    document.getElementById("projects").scrollIntoView({
      behavior: "smooth"
    });
  });
});

/* ===== Project Details Modal Logic ===== */

const projectModal = document.getElementById("projectModal");

function openProjectDetails(project) {
  document.getElementById("modalCategory").textContent =
    project.category || "Uncategorized";

  document.getElementById("modalTitle").textContent =
    project.title || "Untitled project";

  document.getElementById("modalDescription").textContent =
    project.description || "No description provided.";

  const technologyContainer =
    document.getElementById("modalTechnologies");

  technologyContainer.replaceChildren();

  (project.technologies || []).forEach(technology => {
    const tag = document.createElement("span");
    tag.className = "tech-tag";
    tag.textContent = technology;
    technologyContainer.appendChild(tag);
  });

  const githubLink = document.getElementById("modalGithub");

  if (project.github) {
    githubLink.href = project.github;
    githubLink.classList.remove("hidden");
  } else {
    githubLink.removeAttribute("href");
    githubLink.classList.add("hidden");
  }

  projectModal.classList.remove("hidden");
  document.body.classList.add("modal-open");

  document.getElementById("closeProjectModal").focus();
}

function closeProjectDetails() {
  projectModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

document.getElementById("closeProjectModal")
  .addEventListener("click", closeProjectDetails);

projectModal.addEventListener("click", event => {
  if (event.target === projectModal) {
    closeProjectDetails();
  }
});

document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    !projectModal.classList.contains("hidden")
  ) {
    closeProjectDetails();
  }
});

/* Profile dropdown interactions */
const profileButton = document.getElementById("profileButton");
const profileMenu = document.getElementById("profileMenu");
const profileDashboard = document.getElementById("profileDashboard");

if (profileButton && profileMenu) {
  profileButton.addEventListener("click", (event) => {
    event.stopPropagation();

    const isOpening = profileMenu.classList.contains("hidden");
    profileMenu.classList.toggle("hidden");
    profileButton.setAttribute("aria-expanded", String(isOpening));
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile-area")) {
      profileMenu.classList.add("hidden");
      profileButton.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      profileMenu.classList.add("hidden");
      profileButton.setAttribute("aria-expanded", "false");
    }
  });
}



/* ===== PROFILE DASHBOARD NAVIGATION ===== */

const profilePage = document.getElementById("profilePage");
const backToProjects = document.getElementById("backToProjects");
const myProjectsGrid = document.getElementById("myProjectsGrid");

function showProfileDashboard() {
  if (!profilePage) return;

  // Hide the main directory and show the profile page
  document.querySelector(".welcome")?.classList.add("hidden");
  document.querySelector(".stats-grid")?.classList.add("hidden");
  document.querySelector(".projects-section")?.classList.add("hidden");

  profilePage.classList.remove("hidden");

  // Close the avatar dropdown
  profileMenu?.classList.add("hidden");
  profileButton?.setAttribute("aria-expanded", "false");

  // Populate the profile with the latest loaded projects
  updateProfileDashboard();

  profilePage.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function showProjectDirectory() {
  profilePage?.classList.add("hidden");

  document.querySelector(".welcome")?.classList.remove("hidden");
  document.querySelector(".stats-grid")?.classList.remove("hidden");
  document.querySelector(".projects-section")?.classList.remove("hidden");

  document.querySelector(".welcome")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function updateProfileDashboard() {
  
const user = window.projectHubAuth?.getCurrentUser();

const myProjects = user
  ? projects.filter(project => project.ownerUid === user.uid)
  : [];


  const technologySet = new Set(
    myProjects.flatMap(project => project.technologies || [])
  );

  const categorySet = new Set(
    myProjects.map(project => project.category).filter(Boolean)
  );

  document.getElementById("myProjectCount").textContent =
    myProjects.length;

  document.getElementById("myTechnologyCount").textContent =
    technologySet.size;

  document.getElementById("myCategoryCount").textContent =
    categorySet.size;

  if (!myProjectsGrid) return;

  myProjectsGrid.replaceChildren();

  const emptyMessage = document.getElementById("myProjectsEmpty");

  if (emptyMessage) {
    emptyMessage.classList.toggle("hidden", myProjects.length > 0);
  }

  myProjects.forEach(project => {
    const card = document.createElement("article");
    card.className = "project-card";

    const title = document.createElement("h3");
    title.textContent = project.title;

    const description = document.createElement("p");
    description.textContent = project.description;

    const category = document.createElement("span");
    category.className = "tech-tag";
    category.textContent = project.category || "Uncategorized";

    const technologies = document.createElement("div");
    technologies.className = "project-technologies";

    (project.technologies || []).forEach(technology => {
      const tag = document.createElement("span");
      tag.className = "tech-tag";
      tag.textContent = technology;
      technologies.appendChild(tag);
    });

    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "primary-btn";
    detailsButton.textContent = "View details";
    detailsButton.addEventListener("click", () => {
      openProjectDetails(project);
    });

    card.append(title, description, category, technologies, detailsButton);
    myProjectsGrid.appendChild(card);
  });
}

profileDashboard?.addEventListener("click", showProfileDashboard);
backToProjects?.addEventListener("click", showProjectDirectory);



/* ===== SIDEBAR NAVIGATION ===== */
const sidebarLinks = document.querySelectorAll(".side-nav .nav-item");
const projectSection = document.getElementById("projects");
const projectSearch = document.getElementById("search");
const categoryFilter = document.getElementById("category");

sidebarLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const label = link.textContent.trim().toLowerCase();

    if (label.includes("overview")) {
      return; // Keep the existing #overview navigation
    }

    if (
      label.includes("all projects") ||
      label.includes("explore projects")
    ) {
      event.preventDefault();

      sidebarLinks.forEach((item) => item.classList.remove("active"));
      link.classList.add("active");

      if (categoryFilter) categoryFilter.value = "all";

      if (label.includes("all projects") && projectSearch) {
        projectSearch.value = "";
      }

      if (typeof renderProjects === "function") {
        renderProjects();
      }

      if (projectSection) {
        projectSection.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }

      if (label.includes("explore projects") && projectSearch) {
        setTimeout(() => projectSearch.focus(), 400);
      }
    }
  });
});

/* ===== EDIT PROFILE FEATURE ===== */

const editProfileButton = document.getElementById("editProfileButton");
const editProfileForm = document.getElementById("editProfileForm");
const editDisplayName = document.getElementById("editDisplayName");
const editAvatar = document.getElementById("editAvatar");
const editBio = document.getElementById("editBio");
const cancelProfileEdit = document.getElementById("cancelProfileEdit");
const profileFormMessage = document.getElementById("profileFormMessage");

const defaultProfile = {
  name: "ProjectHub Member",
  avatar: "👩🏻‍💻",
  bio: "Building ideas, learning technologies, and sharing projects with the community."
};

function getSavedProfile() {
  try {
    const saved = localStorage.getItem("projecthubProfile");
    return saved ? { ...defaultProfile, ...JSON.parse(saved) } : { ...defaultProfile };
  } catch {
    return { ...defaultProfile };
  }
}


function renderSavedProfile() {
  const profile = getSavedProfile();

  const nameElement = document.getElementById("profileName");
  const avatarElement = document.querySelector(".profile-avatar-large");
  const bioElement = document.querySelector(".profile-bio");

  if (nameElement) {
    nameElement.textContent = profile.name;
  }

  if (avatarElement) {
    avatarElement.textContent = profile.avatar;
  }

  if (bioElement) {
    bioElement.textContent = profile.bio;
  }

  // Update the small avatar in the top-right profile button.
  const headerAvatar = document.querySelector(
    "#profileButton .avatar-icon, #profileButton .profile-avatar, #profileButton svg"
  );

  if (headerAvatar) {
    if (headerAvatar.tagName.toLowerCase() === "svg") {
      const avatarContainer = document.createElement("span");
      avatarContainer.className = "header-profile-emoji";
      avatarContainer.textContent = profile.avatar;
      avatarContainer.setAttribute("aria-label", profile.name);

      headerAvatar.replaceWith(avatarContainer);
    } else {
      headerAvatar.textContent = profile.avatar;
    }
  }
}


function openEditProfile() {
  const profile = getSavedProfile();

  editDisplayName.value = profile.name;
  editAvatar.value = profile.avatar;
  editBio.value = profile.bio;
  profileFormMessage.textContent = "";

  editProfileForm.classList.remove("hidden");
  editProfileForm.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeEditProfile() {
  editProfileForm.classList.add("hidden");
  profileFormMessage.textContent = "";
}

editProfileButton?.addEventListener("click", openEditProfile);

cancelProfileEdit?.addEventListener("click", closeEditProfile);


editProfileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = editDisplayName.value.trim();
  const bio = editBio.value.trim();
  const avatar = editAvatar.value;

  if (!name) {
    profileFormMessage.textContent = "Please enter a display name.";
    return;
  }

  const updatedProfile = {
    name,
    avatar,
    bio: bio || defaultProfile.bio
  };

  try {
    profileFormMessage.textContent = "Saving profile...";

    
const token = await window.projectHubAuth.getIdToken();

const response = await fetch(`${API_BASE_URL}/api/me/profile`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({
    name: updatedProfile.name,
    bio: updatedProfile.bio,
    avatar: updatedProfile.avatar
  })
});

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to save profile.");
    }

    localStorage.setItem(
      "projecthubProfile",
      JSON.stringify(updatedProfile)
    );

    renderSavedProfile();
    closeEditProfile();

    // Refresh profile stats if this function exists.
    if (typeof updateProfileDashboard === "function") {
      updateProfileDashboard();
    }

    alert("Profile saved successfully!");
  } catch (error) {
    profileFormMessage.textContent =
      "Unable to save profile to MongoDB. Please try again.";

    console.error("Profile save error:", error);
  }
});


// Restore saved profile details whenever the app loads.
renderSavedProfile();






loadProjects();
