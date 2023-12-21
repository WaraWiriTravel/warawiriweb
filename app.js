require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
const md5 = require("md5");

const nodemailer = require("nodemailer");

const serviceAccount = require("./warawiriweb-alphetor-firebase-adminsdk-g58h2-354dad6595.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const storage = admin.storage().bucket("warawiriweb-alphetor.appspot.com");

const app = express();
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// create session middleware
app.use(
  session({
    secret: "not_yet_environmentized", // move to .env
    resave: false,
    saveUninitialized: false,
  })
);

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

const storageMulter = multer.memoryStorage();
const upload = multer({ storage: storageMulter });

// create reusable transporter using the default SMTP transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: "warawiribusiness@gmail.com", // move to .env
    pass: "zyyd xjsw ipkd wlsz", // move to .env
  },
});

function generateUniqueToken() {
  return crypto.randomBytes(32).toString("hex");
}

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  db.collection("Blogs")
    .orderBy("up_timestamp", "desc")
    .get()
    .then((snapshot) => {
      const blogs = [];
      const highlightBlogs = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "on") {
          highlightBlogs.push({
            documentID: doc.id,
            ...data,
          });
        } else {
          blogs.push({
            documentID: doc.id,
            ...data,
          });
        }
      });

      const x = 3 - highlightBlogs.length;
      if (x !== 0) {
        highlightBlogs.push(...blogs.slice(0, x));
        blogs.splice(0, x);
      }

      res.render("home", { highlightBlogs: highlightBlogs });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/blog", (req, res) => {
  db.collection("Blogs")
    .orderBy("up_timestamp", "desc")
    .get()
    .then((snapshot) => {
      const blogs = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        blogs.push({
          documentID: doc.id,
          ...data,
        });
      });

      res.render("blog", { blogs: blogs, subscribed: false });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/blog-detail-:title", (req, res) => {
  const title = req.params.title;
  let blogData;

  db.collection("Blogs")
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.title === title) {
          blogData = data;
        }
      });

      if (blogData) {
        res.render("blog-detail", { blog: blogData });
      } else {
        res.send("Blog not found");
      }
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/faq", (req, res) => {
  db.collection("Contact")
    .get()
    .then((snapshot) => {
      const kontak = snapshot.docs[0].data();

      res.render("faq", { kontak: kontak });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/contact", (req, res) => {
  db.collection("Contact")
    .get()
    .then((snapshot) => {
      const kontak = snapshot.docs[0].data();

      res.render("contact", { kontak: kontak });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/home");
  } else {
    res.render("login");
  }
});

app.get("/pricing", (req, res) => {
  let kontak;
  let pakets = [];

  db.collection("Paket")
    .orderBy("up_timestamp", "desc")
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        pakets.push({
          documentID: doc.id,
          ...doc.data(),
        });
      });

      return db.collection("Contact").get();
    })
    .then((contactSnapshot) => {
      kontak = contactSnapshot.docs[0].data();

      res.render("packet-pricing", { pakets: pakets, kontak: kontak });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/paket-detail-:nama", async (req, res) => {
  const nama = req.params.nama;

  try {
    const paketQuery = await db
      .collection("Paket")
      .where("nama", "==", nama)
      .get();

    if (paketQuery.empty) {
      return res.send("Item not found");
    }

    const paketData = paketQuery.docs[0].data();

    const contactQuery = await db.collection("Contact").get();
    const kontak = contactQuery.docs[0].data();

    res.render("packet-pricing-details", { paket: paketData, kontak: kontak });
  } catch (error) {
    res.send("Error: " + error);
  }
});

app.post("/daftar", async (req, res) => {
  try {
    const email = req.body.email;

    const emailsRef = db.collection("Emails");

    const existingEmail = await emailsRef.where("email", "==", email).get();

    if (!existingEmail.empty) {
      return res.redirect("/blog");
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const unsubscribeToken = generateUniqueToken();

    await emailsRef.add({
      email: email,
      timestamp: timestamp,
      unsubscribeToken: unsubscribeToken,
    });

    db.collection("Blogs")
      .orderBy("up_timestamp", "desc")
      .get()
      .then((snapshot) => {
        const blogs = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          blogs.push({
            documentID: doc.id,
            ...data,
          });
        });

        res.render("blog", { blogs: blogs, subscribed: true });
      })
      .catch((error) => {
        res.send("Error: " + error);
      });
  } catch (error) {
    console.error("Error adding email:", error);
    res.status(500).send("Error adding email");
  }
});

app.post("/sendNewsletter", async (req, res) => {
  try {
    const subject = req.body.subject;
    const body = req.body.body;
    let linkType;
    let link;

    if (req.body.linkType !== null && req.body.link !== null) {
      linkType = req.body.linkType;
      link = req.body.link;
    }

    const emailsSnapshot = await db.collection("Emails").get();
    const emails = [];

    emailsSnapshot.forEach((doc) => {
      const data = doc.data();
      emails.push({
        email: data.email,
        unsubscribeToken: data.unsubscribeToken,
      });
    });

    let mailOptions;

    for (const recipient of emails) {
      if (linkType === "paket") {
        const paketLink = `http://103.13.206.43:2023/paket-detail-${encodeURIComponent(
          link
        )}`;
        mailOptions = {
          from: {
            name: "Wara Wiri Tour",
            address: "warawiribusiness@gmail.com", // move to .env
          },
          to: recipient.email,
          subject: subject,
          html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="img/warawiri-logo.svg" />
    <link rel="stylesheet" href="style.css" />
    <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
      rel="stylesheet"
      integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN"
      crossorigin="anonymous"
    />
    <title>News Letter</title>

    <style>
      pre {
        font-family: "Roboto", sans-serif;
        color: black;
        white-space: pre-wrap;
      }
      a {
        text-decoration: none;
        color: inherit;
      }
      .bn6 {
        cursor: pointer;
        outline: none;
        border: none;
        background-color: #f71707;
        padding: 0.3em 1.2em;
        border-radius: 30px;
        font-size: 1.3rem;
        font-weight: 550;
        color: #ffffff;
        background-size: 100% 100%;
        box-shadow: 0 0 0 4px #e6564c inset;
      }

      .bn6:hover {
        background-image: linear-gradient(
          55deg,
          transparent 10%,
          #eb938d 10% 20%,
          transparent 20% 30%,
          #eb938d 30% 40%,
          transparent 40% 50%,
          #eb938d 50% 60%,
          transparent 60% 70%,
          #eb938d 70% 80%,
          transparent 80% 90%,
          #eb938d 90% 100%
        );
        animation: background 3s linear infinite;
      }

      .bn39 {
        background-image: linear-gradient(135deg, #008aff, #86d472);
        border-radius: 6px;
        box-sizing: border-box;
        color: #ffffff;
        display: block;
        height: 50px;
        font-size: 1.4em;
        font-weight: 600;
        padding: 4px;
        position: relative;
        text-decoration: none;
        width: 7em;
        z-index: 2;
      }

      .bn39:hover {
        color: #fff;
      }

      .bn39 .bn39span {
        align-items: center;
        background: #0e0e10;
        border-radius: 6px;
        display: flex;
        justify-content: center;
        height: 100%;
        transition: background 0.5s ease;
        width: 100%;
      }

      .bn39:hover .bn39span {
        background: transparent;
      }
    </style>
  </head>
  <body>
    <!-- Start Navbar -->
    <nav
      class="shadow-sm navbar navbar-expand-lg navbar-light justify-content-center"
    >
      <div class="container">
        <a href="http://103.13.206.43:2023/" style="text-align: center;">
          <img src="https://i.ibb.co/xf06hKp/sketch-transparent.png" alt="Wara Wiri Travel" style="text-align: center;" width="100" />
        </a>
        <a class="navbar-brand" href="#"> <h1 style="color: black; text-align: center;">Tour & Travel Wara Wiri</h1></a>
      </div>
    </nav>
    <!-- End Navbar -->
    <!-- Body -->
    <section>
      <div class="container">
        <div class="row">
          <div><h1 class="text-center" style="text-align: center;">${subject}</h1></div>
        </div>

        <div class="row">
          <pre>
            ${body}
          </pre>
          <div class="col mb-3">
            <a class="bn39" href="${paketLink}" style="color: white; text-align: center;"
              ><span class="bn39span" style="color: white; text-align: center;">For More Info</span></a
            >
          </div>
        </div>
      </div>
    </section>
    <!-- end body -->

    <!-- start footer -->
    <div
      class="shadow-sm container-fluid text-dark footer pt-5 mt-5 wow fadeIn"
      data-wow-delay="0.1s"
    >
      <div class="container">
        <div class="row">
          <div class="col-lg-6 col-md-6">
            <h4 class="mb-4" style="text-align: center;">PT. HAMID JAYA ABADI</h4>
          </div>
          <div class="col-lg-6 col-md-6 text-end">
            <a href="http://103.13.206.43:2023/unsubscribe/${recipient.unsubscribeToken}" style="color: black;">Unsubcribe</a>
          </div>
        </div>
      </div>
    </div>
    <!-- end footer -->

    <script
      src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js"
      integrity="sha384-I7E8VVD/ismYTF4hNIPjVp/Zjvgyol6VFvRkX/vR+Vc4jQkC+hVqc2pM8ODewa9r"
      crossorigin="anonymous"
    ></script>
    <script
      src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.min.js"
      integrity="sha384-BBtl+eGJRgqQAUMxJ7pMwbEyER4l1g+O15P+16Ep7Q9Q+zqX6gSbd85u4mG4QzX+"
      crossorigin="anonymous"
    ></script>
  </body>
</html>`,
        };
      } else if (linkType === "blog") {
        const blogLink = `http://103.13.206.43:2023/blog-detail-${encodeURIComponent(
          link
        )}`;
        mailOptions = {
          from: {
            name: "Wara Wiri Tour",
            address: "warawiribusiness@gmail.com", // move to .env
          },
          to: recipient.email,
          subject: subject,
          html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="img/warawiri-logo.svg" />
    <link rel="stylesheet" href="style.css" />
    <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
      rel="stylesheet"
      integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN"
      crossorigin="anonymous"
    />
    <title>News Letter</title>

    <style>
      pre {
        font-family: "Roboto", sans-serif;
        color: black;
        white-space: pre-wrap;
      }
      a {
        text-decoration: none;
        color: inherit;
      }
      .bn6 {
        cursor: pointer;
        outline: none;
        border: none;
        background-color: #f71707;
        padding: 0.3em 1.2em;
        border-radius: 30px;
        font-size: 1.3rem;
        font-weight: 550;
        color: #ffffff;
        background-size: 100% 100%;
        box-shadow: 0 0 0 4px #e6564c inset;
      }

      .bn6:hover {
        background-image: linear-gradient(
          55deg,
          transparent 10%,
          #eb938d 10% 20%,
          transparent 20% 30%,
          #eb938d 30% 40%,
          transparent 40% 50%,
          #eb938d 50% 60%,
          transparent 60% 70%,
          #eb938d 70% 80%,
          transparent 80% 90%,
          #eb938d 90% 100%
        );
        animation: background 3s linear infinite;
      }

      .bn39 {
        background-image: linear-gradient(135deg, #008aff, #86d472);
        border-radius: 6px;
        box-sizing: border-box;
        color: #ffffff;
        display: block;
        height: 50px;
        font-size: 1.4em;
        font-weight: 600;
        padding: 4px;
        position: relative;
        text-decoration: none;
        width: 7em;
        z-index: 2;
      }

      .bn39:hover {
        color: #fff;
      }

      .bn39 .bn39span {
        align-items: center;
        background: #0e0e10;
        border-radius: 6px;
        display: flex;
        justify-content: center;
        height: 100%;
        transition: background 0.5s ease;
        width: 100%;
      }

      .bn39:hover .bn39span {
        background: transparent;
      }
    </style>
  </head>
  <body>
    <!-- Start Navbar -->
    <nav
      class="shadow-sm navbar navbar-expand-lg navbar-light justify-content-center"
    >
      <div class="container">
        <a href="http://103.13.206.43:2023/" style="text-align: center;">
          <img src="https://i.ibb.co/xf06hKp/sketch-transparent.png" alt="Wara Wiri Travel" style="text-align: center;" width="100" />
        </a>
        <a class="navbar-brand" href="#"> <h1 style="color: black; text-align: center;">Tour & Travel Wara Wiri</h1></a>
      </div>
    </nav>
    <!-- End Navbar -->
    <!-- Body -->
    <section>
      <div class="container">
        <div class="row">
          <div><h1 class="text-center" style="text-align: center;">${subject}</h1></div>
        </div>

        <div class="row">
          <pre>
            ${body}
          </pre>
          <div class="col mb-3">
            <a class="bn39" href="${blogLink}" style="color: white; text-align: center;"
              ><span class="bn39span" style="color: white; text-align: center;">For More Info</span></a
            >
          </div>
        </div>
      </div>
    </section>
    <!-- end body -->

    <!-- start footer -->
    <div
      class="shadow-sm container-fluid text-dark footer pt-5 mt-5 wow fadeIn"
      data-wow-delay="0.1s"
    >
      <div class="container">
        <div class="row">
          <div class="col-lg-6 col-md-6">
            <h4 class="mb-4" style="text-align: center;">PT. HAMID JAYA ABADI</h4>
          </div>
          <div class="col-lg-6 col-md-6 text-end">
            <a href="http://103.13.206.43:2023/unsubscribe/${recipient.unsubscribeToken}" style="color: black;">Unsubcribe</a>
          </div>
        </div>
      </div>
    </div>
    <!-- end footer -->

    <script
      src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js"
      integrity="sha384-I7E8VVD/ismYTF4hNIPjVp/Zjvgyol6VFvRkX/vR+Vc4jQkC+hVqc2pM8ODewa9r"
      crossorigin="anonymous"
    ></script>
    <script
      src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.min.js"
      integrity="sha384-BBtl+eGJRgqQAUMxJ7pMwbEyER4l1g+O15P+16Ep7Q9Q+zqX6gSbd85u4mG4QzX+"
      crossorigin="anonymous"
    ></script>
  </body>
</html>`,
        };
      } else {
        mailOptions = {
          from: {
            name: "Wara Wiri Tour",
            address: "warawiribusiness@gmail.com", // move to .env
          },
          to: recipient.email,
          subject: subject,
          html: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="img/warawiri-logo.svg" />
    <link rel="stylesheet" href="style.css" />
    <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
      rel="stylesheet"
      integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN"
      crossorigin="anonymous"
    />
    <title>News Letter</title>

    <style>
      pre {
        font-family: "Roboto", sans-serif;
        color: black;
        white-space: pre-wrap;
      }
      a {
        text-decoration: none;
        color: inherit;
      }
      .bn6 {
        cursor: pointer;
        outline: none;
        border: none;
        background-color: #f71707;
        padding: 0.3em 1.2em;
        border-radius: 30px;
        font-size: 1.3rem;
        font-weight: 550;
        color: #ffffff;
        background-size: 100% 100%;
        box-shadow: 0 0 0 4px #e6564c inset;
      }

      .bn6:hover {
        background-image: linear-gradient(
          55deg,
          transparent 10%,
          #eb938d 10% 20%,
          transparent 20% 30%,
          #eb938d 30% 40%,
          transparent 40% 50%,
          #eb938d 50% 60%,
          transparent 60% 70%,
          #eb938d 70% 80%,
          transparent 80% 90%,
          #eb938d 90% 100%
        );
        animation: background 3s linear infinite;
      }

      .bn39 {
        background-image: linear-gradient(135deg, #008aff, #86d472);
        border-radius: 6px;
        box-sizing: border-box;
        color: #ffffff;
        display: block;
        height: 50px;
        font-size: 1.4em;
        font-weight: 600;
        padding: 4px;
        position: relative;
        text-decoration: none;
        width: 7em;
        z-index: 2;
      }

      .bn39:hover {
        color: #fff;
      }

      .bn39 .bn39span {
        align-items: center;
        background: #0e0e10;
        border-radius: 6px;
        display: flex;
        justify-content: center;
        height: 100%;
        transition: background 0.5s ease;
        width: 100%;
      }

      .bn39:hover .bn39span {
        background: transparent;
      }
    </style>
  </head>
  <body>
    <!-- Start Navbar -->
    <nav
      class="shadow-sm navbar navbar-expand-lg navbar-light justify-content-center"
    >
      <div class="container">
        <a href="http://103.13.206.43:2023/" style="text-align: center;">
          <img src="https://i.ibb.co/xf06hKp/sketch-transparent.png" alt="Wara Wiri Travel" style="text-align: center;" width="100" />
        </a>
        <a class="navbar-brand" href="#"> <h1 style="color: black; text-align: center;">Tour & Travel Wara Wiri</h1></a>
      </div>
    </nav>
    <!-- End Navbar -->
    <!-- Body -->
    <section>
      <div class="container">
        <div class="row">
          <div><h1 class="text-center" style="text-align: center;">${subject}</h1></div>
        </div>

        <div class="row">
          <pre>
            ${body}
          </pre>
          
        </div>
      </div>
    </section>
    <!-- end body -->

    <!-- start footer -->
    <div
      class="shadow-sm container-fluid text-dark footer pt-5 mt-5 wow fadeIn"
      data-wow-delay="0.1s"
    >
      <div class="container">
        <div class="row">
          <div class="col-lg-6 col-md-6">
            <h4 class="mb-4" style="text-align: center;">PT. HAMID JAYA ABADI</h4>
          </div>
          <div class="col-lg-6 col-md-6 text-end">
            <a href="http://103.13.206.43:2023/unsubscribe/${recipient.unsubscribeToken}" style="color: black;">Unsubcribe</a>
          </div>
        </div>
      </div>
    </div>
    <!-- end footer -->

    <script
      src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.11.8/dist/umd/popper.min.js"
      integrity="sha384-I7E8VVD/ismYTF4hNIPjVp/Zjvgyol6VFvRkX/vR+Vc4jQkC+hVqc2pM8ODewa9r"
      crossorigin="anonymous"
    ></script>
    <script
      src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.min.js"
      integrity="sha384-BBtl+eGJRgqQAUMxJ7pMwbEyER4l1g+O15P+16Ep7Q9Q+zqX6gSbd85u4mG4QzX+"
      crossorigin="anonymous"
    ></script>
  </body>
</html>`,
        };
      }

      await transporter.sendMail(mailOptions);
    }

    console.log("Email has been sent successfully");
    res.redirect("/newsletter");
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).send("Error sending email");
  }
});

app.post("/createpost", upload.single("gambar"), (req, res) => {
  const title = req.body.judul;
  const content = req.body.Berita;
  const imageBuffer = req.file.buffer;
  const isHighlight = req.body.status === undefined ? "off" : req.body.status;

  const postRef = db.collection("Blogs").doc();
  const documentID = postRef.id;
  const storageFolder = `Blogs/${documentID}/`;
  const fileName = req.file.originalname;

  const file = storage.file(storageFolder + fileName);

  file.save(
    imageBuffer,
    {
      metadata: {
        contentType: req.file.mimetype,
      },
      predefinedAcl: "publicRead",
    },
    (err) => {
      if (err) {
        res.send("Error: " + err);
      } else {
        const imageUrl = `https://storage.googleapis.com/${storage.name}/${storageFolder}${fileName}`;

        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        postRef
          .set({
            title: title,
            content: content,
            imageUrl: imageUrl,
            status: isHighlight,
            cr_timestamp: timestamp,
            up_timestamp: timestamp,
          })
          .then(async () => {
            const querySnapshot = await db
              .collection("Blogs")
              .where("status", "==", "on")
              .orderBy("up_timestamp", "asc")
              .get();

            if (querySnapshot.size > 3) {
              const oldestBlog = querySnapshot.docs[0];
              await oldestBlog.ref.update({ status: "off" });
            }

            res.redirect("/blog-admin");
          })
          .catch((error) => {
            res.send("Error: " + error);
          });
      }
    }
  );
});

app.post("/createItem", upload.array("gambar"), async (req, res) => {
  const namaPaket = req.body.nama;
  const minHarga = req.body.minHarga;
  const maxHarga = req.body.maxHarga;
  const desc = req.body.desc;
  const gambarFiles = req.files;

  const gambarUrls = [];
  const itemRef = db.collection("Paket").doc();

  const documentID = itemRef.id;

  const storagePromises = [];

  gambarFiles.forEach((gambarFile) => {
    const imageBuffer = gambarFile.buffer;
    const fileName = gambarFile.originalname;
    const storageFolder = `Paket/${documentID}/`;
    const fileUrl = `https://storage.googleapis.com/${storage.name}/${storageFolder}${fileName}`;

    const storageFile = storage.file(storageFolder + fileName);

    const storagePromise = new Promise((resolve, reject) => {
      storageFile.save(
        imageBuffer,
        {
          metadata: {
            contentType: gambarFile.mimetype,
          },
          predefinedAcl: "publicRead",
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            gambarUrls.push(fileUrl);
            resolve();
          }
        }
      );
    });

    storagePromises.push(storagePromise);
  });

  try {
    await Promise.all(storagePromises);

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    await itemRef.set({
      nama: namaPaket,
      minHarga: minHarga,
      maxHarga: maxHarga,
      desc: desc,
      gambar: gambarUrls,
      cr_timestamp: timestamp,
      up_timestamp: timestamp,
    });

    res.redirect("paket");
  } catch (error) {
    res.send("Error: " + error);
  }
});

app.post("/updatepost", upload.single("newImage"), async (req, res) => {
  let imageUrl;
  const title = req.body.judul;
  const content = req.body.Berita;
  const documentID = req.body.ID;
  const isHighlight = req.body.status === undefined ? "off" : req.body.status;

  try {
    if (req.body.newImage) {
      const oldPost = await db.collection("Blogs").doc(documentID).get();
      if (oldPost.exists) {
        const oldData = oldPost.data();
        if (oldData.imageUrl) {
          const oldImageUrl = oldData.imageUrl;
          const fileName = oldImageUrl.split("/").pop();
          const storageFolder = `Blogs/${documentID}/`;

          const oldFile = storage.file(storageFolder + fileName);
          await oldFile.delete();
        }
      }

      if (req.file && req.file.buffer) {
        const imageBuffer = req.file.buffer;
        const storageFolder = `Blogs/${documentID}/`;
        const fileName = req.file.originalname;

        const file = storage.file(storageFolder + fileName);

        await file.save(imageBuffer, {
          metadata: {
            contentType: req.file.mimetype,
          },
          predefinedAcl: "publicRead",
        });

        imageUrl = `https://storage.googleapis.com/${storage.name}/${storageFolder}${fileName}`;
      }
    }

    const postRef = db.collection("Blogs").doc(documentID);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const updateData = {
      title: title,
      content: content,
      up_timestamp: timestamp,
      status: isHighlight,
    };

    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    await postRef.set(updateData, { merge: true });

    const querySnapshot = await db
      .collection("Blogs")
      .where("status", "==", "on")
      .orderBy("up_timestamp", "asc")
      .get();

    if (querySnapshot.size > 3) {
      const oldestBlog = querySnapshot.docs[0];
      await oldestBlog.ref.update({ status: "off" });
    }

    console.log("Post updated successfully");
    res.redirect("/blog-admin");
  } catch (error) {
    console.log("Error updating post: " + error);
    res.send("Error updating post: " + error);
  }
});

app.post("/updateItem", upload.array("gambar"), async (req, res) => {
  const documentID = req.body.ID;
  const namaPaket = req.body.nama;
  const minHarga = req.body.minHarga;
  const maxHarga = req.body.maxHarga;
  const desc = req.body.desc;
  const gambarFiles = req.files;

  try {
    let oldImageUrls = [];
    let newImageUrls = [];

    // Get existing images
    const oldPost = await db.collection("Paket").doc(documentID).get();
    if (oldPost.exists) {
      const oldData = oldPost.data();
      if (oldData.gambar) {
        oldImageUrls = oldData.gambar;
      }
    }

    // Delete old images
    for (const oldImageUrl of oldImageUrls) {
      const fileName = oldImageUrl.split("/").pop();
      const storageFolder = `Paket/${documentID}/`;
      const oldFile = storage.file(storageFolder + fileName);
      await oldFile.delete();
    }

    // Upload new images
    for (const file of gambarFiles) {
      const imageBuffer = file.buffer;
      const storageFolder = `Paket/${documentID}/`;
      const fileName = file.originalname;

      const fileRef = storage.file(storageFolder + fileName);

      await fileRef.save(imageBuffer, {
        metadata: {
          contentType: file.mimetype,
        },
        predefinedAcl: "publicRead",
      });

      const imageUrl = `https://storage.googleapis.com/${storage.name}/${storageFolder}${fileName}`;
      newImageUrls.push(imageUrl);
    }

    // Update Firestore document
    const postRef = db.collection("Paket").doc(documentID);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const updateData = {
      nama: namaPaket,
      minHarga: minHarga,
      maxHarga: maxHarga,
      desc: desc,
      up_timestamp: timestamp,
    };

    // Set the gambar field explicitly to the newImageUrls array
    if (newImageUrls.length > 0) {
      updateData.gambar = newImageUrls;
    } else {
      // If there are no new images, you might want to set gambar to an empty array
      updateData.gambar = [];
    }

    await postRef.set(updateData, { merge: true });

    console.log("Item updated successfully");
    res.redirect("/paket");
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).send("Error updating item");
  }
});

app.post("/updateContact", requireAuth, async (req, res) => {
  try {
    const newEmail = req.body.email;
    const newNoTelp = req.body.noTelp;

    const contactRef = db.collection("Contact").doc("TcFCStsO4m62PHisotDW");

    await contactRef.update({
      email: newEmail,
      noTelp: newNoTelp,
    });

    console.log("Contact updated successfully");
    res.redirect("/info-kontak");
  } catch (error) {
    console.error("Error updating contact:", error);
    res.status(500).send("Error updating contact");
  }
});

app.post("/deletepost/:documentID", async (req, res) => {
  try {
    const documentID = req.params.documentID;

    const postDoc = await db.collection("Blogs").doc(documentID).get();
    if (!postDoc.exists) {
      res.status(404).send("Post not found");
      return;
    }

    const storageFolder = `Blogs/${documentID}/`;
    await storage.deleteFiles({ prefix: storageFolder });

    await db.collection("Blogs").doc(documentID).delete();

    res.sendStatus(200);
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).send("Error deleting post");
  }
});

app.post("/deleteItem/:documentID", async (req, res) => {
  try {
    const documentID = req.params.documentID;

    const paketDoc = await db.collection("Paket").doc(documentID).get();
    if (!paketDoc.exists) {
      res.status(404).send("Item not found");
      return;
    }

    const storageFolder = `Paket/${documentID}/`;
    await storage.deleteFiles({ prefix: storageFolder });

    await db.collection("Paket").doc(documentID).delete();

    res.sendStatus(200);
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).send("Error deleting post");
  }
});

app.post("/deleteEmail/:documentID", async (req, res) => {
  try {
    const documentID = req.params.documentID;

    const emailDoc = await db.collection("Emails").doc(documentID).get();
    if (!emailDoc.exists) {
      res.status(404).send("Email not found");
      return;
    }

    await db.collection("Emails").doc(documentID).delete();

    res.sendStatus(200);
  } catch (error) {
    console.error("Error unsubscribing email:", error);
    res.status(500).send("Error unsubscribing email");
  }
});

app.get("/unsubscribe/:token", async (req, res) => {
  try {
    const token = req.params.token;

    const emailDoc = await db
      .collection("Emails")
      .where("unsubscribeToken", "==", token)
      .get();

    if (emailDoc.empty) {
      res.status(404).send("Invalid unsubscribe token");
      return;
    }

    await emailDoc.docs[0].ref.delete();

    res.send("Unsubscribe successful");
  } catch (error) {
    console.error("Error processing unsubscribe request:", error);
    res.status(500).send("Error processing unsubscribe request");
  }
});

app.post("/updatestatus/:documentID", async (req, res) => {
  const documentID = req.params.documentID;
  const status = req.query.status;
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  const postRef = db.collection("Blogs").doc(documentID);

  return postRef
    .update({
      status: status,
      up_timestamp: timestamp,
    })
    .then(async () => {
      const querySnapshot = await db
        .collection("Blogs")
        .where("status", "==", "on")
        .orderBy("up_timestamp", "asc")
        .get();

      if (querySnapshot.size > 3) {
        const oldestBlog = querySnapshot.docs[0];
        await oldestBlog.ref.update({ status: "off" });
      }

      res.sendStatus(200);
    })
    .catch((error) => {
      console.error("Error updating status:", error);
      res.status(500).send("Error updating status");
    });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  let user = [];
  await db
    .collection("User")
    .get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        user.push({
          ...doc.data(),
        });
      });
    });

  const activeUser = user.find(
    (u) => u.username === username && u.password === md5(password)
  );

  if (activeUser) {
    // store user data in the session
    req.session.user = activeUser;
    res.redirect("/home");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  // destroy session and logout
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    }
    res.redirect("/");
  });
});

// app.get("/sidebar", (req, res) => {
//   res.render("admin/sidebar");
// });

app.get("/home", requireAuth, (req, res) => {
  db.collection("Blogs")
    .orderBy("up_timestamp", "desc")
    .get()
    .then((snapshot) => {
      const blogs = [];
      const highlightBlogs = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "on") {
          highlightBlogs.push({
            documentID: doc.id,
            ...data,
          });
        } else {
          blogs.push({
            documentID: doc.id,
            ...data,
          });
        }
      });

      const x = 3 - highlightBlogs.length;
      if (x > 0) {
        highlightBlogs.push(...blogs.slice(0, x));
        blogs.splice(0, x);
      }

      res.render("admin/home", { highlightBlogs: highlightBlogs });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/blog-admin", requireAuth, (req, res) => {
  db.collection("Blogs")
    .get()
    .then((snapshot) => {
      const blogs = [];
      snapshot.forEach((doc) => {
        blogs.push({
          documentID: doc.id,
          ...doc.data(),
        });
      });

      res.render("admin/blog-admin", { blogs: blogs });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/tambah-berita", requireAuth, (req, res) => {
  res.render("admin/tambah-berita");
});

app.get("/edit-berita", requireAuth, (req, res) => {
  const query = req.query;
  res.render("admin/edit-berita", { query });
});

app.get("/paket", requireAuth, (req, res) => {
  db.collection("Paket")
    .get()
    .then((snapshot) => {
      const paket = [];
      snapshot.forEach((doc) => {
        paket.push({
          documentID: doc.id,
          ...doc.data(),
        });
      });

      res.render("admin/paket", { pakets: paket });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/tambah-paket", requireAuth, (req, res) => {
  res.render("admin/tambah-paket");
});

app.get("/edit-paket", requireAuth, (req, res) => {
  const query = req.query;
  res.render("admin/edit-paket", { query });
});

app.get("/info-kontak", requireAuth, (req, res) => {
  db.collection("Contact")
    .get()
    .then((snapshot) => {
      const kontak = snapshot.docs[0].data();

      res.render("admin/info-kontak", { kontak: kontak });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/newsletter", requireAuth, (req, res) => {
  db.collection("Emails")
    .get()
    .then((snapshot) => {
      const emails = [];
      snapshot.forEach((doc) => {
        emails.push({
          documentID: doc.id,
          ...doc.data(),
        });
      });

      res.render("admin/newsletter", { emails: emails });
    })
    .catch((error) => {
      res.send("Error: " + error);
    });
});

app.get("/tambah-newsletter", requireAuth, async (req, res) => {
  try {
    const [blogsSnapshot, paketSnapshot] = await Promise.all([
      db.collection("Blogs").get(),
      db.collection("Paket").get(),
    ]);

    const blogs = blogsSnapshot.docs.map((doc) => ({
      documentID: doc.id,
      ...doc.data(),
    }));

    const paket = paketSnapshot.docs.map((doc) => ({
      documentID: doc.id,
      ...doc.data(),
    }));

    res.render("admin/tambah-newsletter", { blogs, paket });
  } catch (error) {
    res.status(500).send("Error: " + error);
  }
});

app.listen(process.env.PORT || 2023, function () {
  console.log("Server berjalan di http://localhost:2023");
});
