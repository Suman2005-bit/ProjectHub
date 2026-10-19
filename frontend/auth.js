
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCpvz3JG9KGARbRBaU2AJ8T4dPqLMIB2fY",
  authDomain: "projecthub-c3cf5.firebaseapp.com",
  projectId: "projecthub-c3cf5",
  storageBucket: "projecthub-c3cf5.firebasestorage.app",
  messagingSenderId: "699742166027",
  appId: "1:699742166027:web:191cf6deb3b457e73b7b0e",
  measurementId: "G-BE177SFRW7"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

let isRegisterMode = false;

const authScreen = document.getElementById("authScreen");
const authForm = document.getElementById("authForm");
const authNameGroup = document.getElementById("authNameGroup");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmitButton = document.getElementById("authSubmitButton");
const authMessage = document.getElementById("authMessage");
const showLoginButton = document.getElementById("showLoginButton");
const showRegisterButton = document.getElementById("showRegisterButton");
const googleLoginButton = document.getElementById("googleLoginButton");

function setMessage(message = "") {
  authMessage.textContent = message;
}

function showAuthScreen(show) {
  authScreen.classList.toggle("hidden", !show);

  const mainArea = document.querySelector(".main-area");
  const sidebar = document.querySelector(".sidebar");

  mainArea.querySelectorAll(":scope > *:not(#authScreen)").forEach(element => {
    element.classList.toggle("hidden", show);
  });

  if (sidebar) {
    sidebar.classList.toggle("hidden", show);
  }
}

function setMode(registerMode) {
  isRegisterMode = registerMode;
  authNameGroup.classList.toggle("hidden", !registerMode);
  authName.required = registerMode;
  authPassword.autocomplete = registerMode ? "new-password" : "current-password";
  authSubmitButton.textContent = registerMode ? "Create Account" : "Login";
  showLoginButton.classList.toggle("active", !registerMode);
  showRegisterButton.classList.toggle("active", registerMode);
  setMessage();
}

showLoginButton.addEventListener("click", () => setMode(false));
showRegisterButton.addEventListener("click", () => setMode(true));

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  setMessage();
  authSubmitButton.disabled = true;

  try {
    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (isRegisterMode) {
      const name = authName.value.trim();

      if (!name) {
        throw new Error("Please enter your name.");
      }

      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(result.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    const messages = {
      "auth/email-already-in-use": "An account already exists with this email.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/weak-password": "Choose a stronger password with at least 6 characters.",
      "auth/popup-closed-by-user": "The Google sign-in window was closed.",
      "auth/unauthorized-domain": "This website domain isn't authorized in Firebase."
    };

    setMessage(messages[error.code] || error.message || "Authentication failed.");
  } finally {
    authSubmitButton.disabled = false;
  }
});

googleLoginButton.addEventListener("click", async () => {
  setMessage();
  googleLoginButton.disabled = true;

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const messages = {
      "auth/popup-closed-by-user": "The Google sign-in window was closed.",
      "auth/unauthorized-domain": "Add this website domain to Firebase's authorized domains.",
      "auth/popup-blocked": "Allow popups for this website and try again."
    };

    setMessage(messages[error.code] || error.message || "Google sign-in failed.");
  } finally {
    googleLoginButton.disabled = false;
  }
});

// Expose authentication functions to the existing app.js.
window.projectHubAuth = {
  auth,
  getCurrentUser: () => auth.currentUser,
  getIdToken: async () => {
    if (!auth.currentUser) {
      throw new Error("Please log in first.");
    }
    return auth.currentUser.getIdToken();
  },
  logout: () => signOut(auth),
  onAuthStateChanged: callback => onAuthStateChanged(auth, callback)
};

// Add a logout button without replacing the existing profile menu.
const profileArea = document.querySelector(".profile-area");

if (profileArea && !document.getElementById("logoutButton")) {
  const logoutButton = document.createElement("button");
  logoutButton.id = "logoutButton";
  logoutButton.type = "button";
  logoutButton.textContent = "Log out";
  logoutButton.className = "secondary-btn";
  logoutButton.style.marginLeft = "8px";
  profileArea.appendChild(logoutButton);

  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  });
}

onAuthStateChanged(auth, user => {
  showAuthScreen(!user);

  if (user) {
    setMessage();
    console.log("Signed in to ProjectHub.");
  } else {
    setMode(false);
  }
});
