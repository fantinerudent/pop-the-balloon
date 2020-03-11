"use strict";

const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;
// utilisation du module mongoDB
const MongoClient = require("mongodb").MongoClient;
const uri =
  "mongodb+srv://frudent:weshyo59@cluster0-3woch.mongodb.net/test?retryWrites=true&w=majority";
const bodyParser = require("body-parser");

// gestion des sessions:
const uuidv1 = require("uuid/v1");
const expressSession = require("express-session");
var cookieSession = require("cookie-session");
// utilisation de chalk pour rendre l'exercice plus lisible:
const chalk = require("chalk");
var error = chalk.bold.red;
const ONE_HOUR = 1000 * 60 * 60;
const SESSION_lifeTime = ONE_HOUR;

const session = {
  name: "sid",
  cookie: {
    maxAge: SESSION_lifeTime
  },
  rolling: true,
  secret: "Alawaléguainbistouly",
  saveUninitialized: true,
  resave: false
};

app.use(expressSession(session));

// utilisation du module pug :
app.set("view engine", "pug");
app.set("views", "./views");

// déclaration de l'emplacement des fichiers statiques:
app.use("/img", express.static(__dirname + "/src/img"));
app.use("/css", express.static(__dirname + "/src/css"));
app.use("/js", express.static(__dirname + "/src/js"));

app.use(bodyParser.urlencoded({ extended: false }));

function strUcFirst(a) {
  return (a + "").charAt(0).toUpperCase() + a.substr(1);
}

//
// middleware fonction :
//
// si l'utilisateur n'est pas authentifié;

const redirectionLogin = (req, res, next) => {
  if (!req.session.userId) {
    res.redirect("/login");
  } else {
    next();
  }
};
const redirectionGame = (req, res, next) => {
  if (req.session.userId) {
    res.redirect("/room");
  } else {
    next();
  }
};

app.get("/", redirectionLogin, (req, res) => {
  res.render("salle", {
    roomName: req.params.room,
    pseudonyme: req.session.pseudonyme,
    sourceAvatar: req.session.avatar
  });
});

app.get("/login", redirectionGame, (req, res) => {
  res.render("login");
});

app.get("/inscription", redirectionGame, (req, res) => {
  res.render("inscription");
});

const rooms = [];

app.post("/room", redirectionLogin, (req, res) => {
  rooms.push(req.body.nouvelleRoom);
  ioServer.emit("room-created", rooms);
  res.redirect(req.body.nouvelleRoom);
});

app.get("/:room", redirectionLogin, (req, res) => {
  res.render("room", {
    roomName: req.params.room,
    pseudonyme: strUcFirst(req.session.pseudonyme),
    sourceAvatar: req.session.avatar
  });
});


app.post("/login", redirectionGame, (req, res) => {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  client.connect((err, client) => {
    let db = client.db("jeu_multi");
    let collection = db.collection("utilisateurs");
    collection
      .find({ pseudonyme: req.body.pseudonyme })
      .toArray(function(err, result) {
        if (err) {
          console.log(
            error("impossible de se connecter à la collection de données ")
          );
          client.close();
        }

        if (!result.length) {
          res.render("login", {
            message:
              "le pseudo renseigné n'est pas valable, veuillez vous inscrire"
          });
        } else {
          const infoUser = result[0];
          // si le pseudo et le mot de passe entrés correspondent à ce que j'ai en base de données, ca signifie que l'utilisateur est identifié, j'utilise l'UUID généré pour l'assigné ET a la requete session & à l'user.
          if (req.body.password === infoUser.password) {
            req.session.pseudonyme = req.body.pseudonyme;
            req.session.userId = uuidv1();
            infoUser.userId = req.session.userId;
            res.redirect("/");
          } else {
            res.render("login", {
              message: "mauvais mot de passe"
            });
            client.close();
          }
        }
      });
  });
});

app.post("/inscription", redirectionGame, (req, res) => {
  //connection à mongodb
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  client.connect((err) => {
    if (err) {
      console.log(err)
      console.log(error("Impossible de se connecter à la base de données"));
    }
    // si connection à mongodb réussie, alors je défini la database utilisée ainsi que la collection.
    let db = client.db("jeu_multi");
    let collection = db.collection("utilisateurs");
    collection
      .find({ pseudonyme: req.body.pseudonyme })
      .toArray(function(err, result) {
        if (err) {
          console.log(
            error("impossible de se connecter à la collection de données ")
          );
        }
        if (!result.length) {
          let insertion = {};
          insertion.pseudonyme = req.body.pseudonyme;
          insertion.password = req.body.password;
          insertion.uuid = uuidv1();
          req.session.uuid = insertion.uuid;
          collection.insertOne(insertion, (err, result) => {
            res.render("login", {
              message: "vous êtes inscrits, veuillez maintenant vous connecter."
            });
          });
        } else {
          res.render("login", {
            message:
              "le nom d'utilisateur existe déjà; veuillez vous connecter."
          });
        }
      });
  });
});

const HTTPserver = app.listen(PORT, (req, res) => {
  console.log(chalk.bgMagenta("serveurHTPP connecté"));
});

const io = require("socket.io");

const ioServer = io(HTTPserver);

const allnewBalloons = {};
const players = [];

ioServer.on("connect", function(ioSocket) {
  ioSocket.on("ioSocket_pseudo", pseudo => {
    ioSocket.pseudonyme = pseudo;
    if (!players.includes(pseudo)) {
      players.push(pseudo);
    }
    const newBalloon = {
      id: ioSocket.id,
      top: 0,
      left: 0,
      width: "50px",
      height: "50px",
      borderRadius: "100%",
      position: "absolute",
      innerText: pseudo,
      backgroundColor: "#" + (((1 << 24) * Math.random()) | 0).toString(16)
    };
    // la variable newBalloon contient les propriétés de mon carré

    // j'ajoute au tableau de ts les newBalloons, le newBalloon qui vient d'etre crée par la connexion socket.
    allnewBalloons[newBalloon.id] = newBalloon;

    // On envoie les propriétés du carré du client à TOUS les clients :

    ioServer.emit("updateClientnewBalloon", newBalloon);

    ioSocket.on("newMouseCoordinates", function(mouseCoordinates) {
      for (let anewBalloonId in allnewBalloons) {
        if (anewBalloonId === newBalloon.id) {
          allnewBalloons[anewBalloonId] === newBalloon;
        } else {
          allnewBalloons[anewBalloonId];
        }
      }

      newBalloon.top = mouseCoordinates.top - parseFloat(newBalloon.width) / 2;
      newBalloon.left = mouseCoordinates.left - parseFloat(newBalloon.height) / 2;

      // On envoie les propriétés du carré mises à jour à TOUS les clients
      ioServer.emit("updateClientnewBalloon", newBalloon);
    });

    ioSocket.on("windowClicked", function() {
      for (let anewBalloonId in allnewBalloons) {
        if (anewBalloonId === newBalloon.id) {
          allnewBalloons[anewBalloonId] === newBalloon;
        } else {
          allnewBalloons[anewBalloonId];
        }
      }
      if (players.length === 2) {
        if (allnewBalloons[newBalloon.id].height === "100px") {
          ioSocket.emit("youWon", { message: "congrats you won" });
        } else {
          ioSocket.emit("two_players", {
            message:
              "cliquez le plus rapidement possible jusqu'à faire exploser le balloon"
          });
          allnewBalloons[newBalloon.id].height =
            parseInt(allnewBalloons[newBalloon.id].height) + 1 + "px";
          allnewBalloons[newBalloon.id].width =
            parseInt(allnewBalloons[newBalloon.id].width) + 1 + "px";
        }
      } else {
        ioServer.emit("wait", { message: "attendez un autre joueur" });
      }

      // On envoie les propriétés du carré mises à jour à TOUS les clients
      ioServer.emit("updateClientnewBalloon", newBalloon);
    });

    ioSocket.on("disconnect", function() {
      delete allnewBalloons[newBalloon.id];
      ioServer.emit("youLoose", { message: "sorry you loose" });
      ioServer.emit("deleteClientnewBalloon", newBalloon);
    });
  });
});
