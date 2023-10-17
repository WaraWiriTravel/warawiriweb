const express = require("express");
const bodyParser = require("body-parser");
const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");
const { getStorage, ref } = require("firebase/storage");

/*
pindahin ke firebaseFunction.js
const {
  firestore,
  storage,
  getTime,
  createDataStore,
  readDataStore,
  updateDataStore,
  deleteDataStore,
  createFileStorage,
  deleteFileStorage,
} = require("./firebaseFunctions");

npm install firebase
npm install @firebase/firestore
npm install @firebase/storage
*/

const app = express();
app.use(express.static("public"));

const firebaseConfig = {
  apiKey: "AIzaSyDe2PJ7aGcAREEmOLKeGQNAKucbGkl62ss",
  authDomain: "inventarisgudangdci.firebaseapp.com",
  projectId: "inventarisgudangdci",
  storageBucket: "inventarisgudangdci.appspot.com",
  messagingSenderId: "844624800675",
  appId: "1:844624800675:web:8374b2378bc234f2d5c816",
};

const firebase = initializeApp(firebaseConfig);
const firestore = getFirestore(firebase);
const storage = getStorage();

function getTime() {
  const time = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return time;
}

function createDataStore(col, data) {
  const postCollection = collection(firestore, col);
  const postData = data;
  const newPostRef = addDoc(postCollection, postData)
    .then((docRef) => {
      console.log("Document written with ID: ", docRef.id);
    })
    .catch((error) => {
      console.error("Error adding document: ", error);
    });
}

function readDataStore(col) {
  const postCollection = collection(firestore, col);
  const querySnapshot = getDocs(postCollection)
    .then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        console.log("Document ID:", doc.id);
        console.log("Data:", doc.data());
      });
    })
    .catch((error) => {
      console.error("Error getting documents: ", error);
    });
}

function updateDataStore(col, docID, newData) {
  const postRef = doc(firestore, col, docID);
  updateDoc(postRef, newData)
    .then(() => {
      console.log("Document successfully updated!");
    })
    .catch((error) => {
      console.error("Error updating document: ", error);
    });
}

function deleteDataStore(col, docID, storagePath) {
  const postRef = doc(firestore, col, docID);
  deleteDoc(postRef)
    .then(() => {
      console.log("Document successfully deleted!");
    })
    .catch((error) => {
      console.error("Error deleting document: ", error);
    });

  if (storagePath) {
    const storageRef = ref(storage, storagePath);
    deleteObject(storageRef)
      .then(() => {
        console.log("File deleted from storage.");
      })
      .catch((error) => {
        console.error("Error deleting file from storage: ", error);
      });
  }
}

function createFileStorage(path, file) {
  const storageRef = ref(storage, path + "/" + file.name);
  const fileUploadTask = uploadBytes(storageRef, file);
  fileUploadTask
    .then((snapshot) => {
      console.log("File uploaded:", snapshot.totalBytes, "bytes");
      console.log("File URL:", getDownloadURL(storageRef));
    })
    .catch((error) => {
      console.error("Error uploading file: ", error);
    });
}

function deleteFileStorage(path) {
  const storageRef = ref(storage, path);
  deleteObject(storageRef)
    .then(() => {
      console.log("File deleted from storage.");
    })
    .catch((error) => {
      console.error("Error deleting file from storage: ", error);
    });
}

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/blog", (req, res) => {
  res.render("blog");
});

app.get("/blog-detail", (req, res) => {
  res.render("blog-detail");
});
app.listen(2023, function () {
  console.log("Server berjalan di http://localhost:2023");
});
