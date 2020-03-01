"use strict";

const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000
// utilisation du module mongoDB
const MongoClient = require("mongodb").MongoClient;
const bodyParser = require("body-parser");
// utilisation du module complémentaire qui génère un identifiant unique.
const connectMongo = require("connect-mongo");
// gestion des sessions:
const uuidv1 = require("uuid/v1");
const expressSession = require("express-session");
const MongoStore = connectMongo(expressSession);
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
  store: new MongoStore({
    url: "mongodb://localhost:27017/jeu_multi"
  }),
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
  MongoClient.connect(
    "mongodb://localhost:27017",
    { useUnifiedTopology: true },
    (err, client) => {
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
              var avatar = infoUser.avatar;
              var sourceAvatar = "/img/avatars/" + avatar + ".png";
              req.session.avatar = sourceAvatar;
              // res.render("login", {
              //   userId: req.session.uuid,
              //   pseudonyme: strUcFirst(req.body.pseudonyme),
              //   sourceAvatar
              // });
              res.redirect("/");
            } else {
              res.render("login", {
                message: "mauvais mot de passe"
              });
              client.close();
            }
          }
        });
    }
  );
});

app.post("/inscription", redirectionGame, (req, res) => {
  //connection à mongodb
  MongoClient.connect(
    "mongodb://localhost:27017",
    { useUnifiedTopology: true },
    (err, client) => {
      if (err) {
        console.log(error("Impossible de se connecter à la base de données"));
      }
      // si connection a mongodb reussie, alors je defini la database utilisée ainsi que la collection.
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

            // ICI JE DOIS GERER LE CHOIX DE LAVATAR LORS DE LINSCRIPTION.
            insertion.avatar = "poop";
            req.session.pseudonyme = req.body.pseudonyme;
            var sourceAvatar = "/img/avatars/" + insertion.avatar + ".png";
            collection.insertOne(insertion, (err, result) => {
              res.render("login", {
                message:
                  "vous êtes inscrits, veuillez maintenant vous connecter."
              });
            });
          } else {
            res.render("login", {
              message:
                "le nom d'utilisateur existe déjà; veuillez vous connecter."
            });
          }
        });
    }
  );
});

const HTTPserver = app.listen( PORT, (req, res) => {
  console.log(chalk.bgMagenta("serveurHTPP connecté sur le port 8000"));
});

const io = require("socket.io");

const ioServer = io(HTTPserver);

const allSquares = {};
const players = [];

ioServer.on("connect", function(ioSocket) {
  ioSocket.on("ioSocket_pseudo", pseudo => {
    ioSocket.pseudonyme = pseudo;
    if (!players.includes(pseudo)) {
        players.push(pseudo);
    }

    console.log(players, "players", players.length);
    const square = {
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
    // la variable square contient les propriétés de mon carré

    // j'ajoute au tableau de ts les squares, le square qui vient d'etre crée par la connexion socket.
    allSquares[square.id] = square;

    // On envoie les propriétés du carré du client à TOUS les clients :

    ioServer.emit("updateClientSquare", square);

    ioSocket.on("newMouseCoordinates", function(mouseCoordinates) {
      for (let aSquareId in allSquares) {
        if (aSquareId === square.id) {
          // mon carré dans le tableau des carrés.
          allSquares[aSquareId] === square;
          // allSquares[aSquareId] est la propriété qui contient mon carré.
          // la variable square contient mon carré également.
        } else {
          // Un carré parmis tous les carrés créés.
          allSquares[aSquareId];
          // : un carré qui n'est pas le mien
        }
      }

      square.top = mouseCoordinates.top - parseFloat(square.width) / 2;
      square.left = mouseCoordinates.left - parseFloat(square.height) / 2;

      // On envoie les propriétés du carré mises à jour à TOUS les clients
      ioServer.emit("updateClientSquare", square);
    });

    ioSocket.on("windowClicked", function() {
      for (let aSquareId in allSquares) {
        if (aSquareId === square.id) {
          // mon carré dans le tableau des carrés.
          allSquares[aSquareId] === square;
          // allSquares[aSquareId] est la propriété qui contient mon carré.
          // la variable square contient mon carré également.
        } else {
          // Un carré parmis tous les carrés créés.
          allSquares[aSquareId];
          // : un carré qui n'est pas le mien
        }
      }
      if (players.length === 2) {
        if (allSquares[square.id].height === "100px") {
          ioSocket.emit("youWon", { message: "congrats you won" });
        // ioServer.emit("youLoose",  {message: "sorry you loose"})
      


        } else {
          ioSocket.emit("two_players", {message: "cliquez le plus rapidement possible jusqu'à faire exploser le ballon"})
          allSquares[square.id].height =
            parseInt(allSquares[square.id].height) + 1 + "px";
          allSquares[square.id].width =
            parseInt(allSquares[square.id].width) + 1 + "px";
        }
      } else {
        ioServer.emit("wait",  { message: "attendez un autre joueur" });
      }

      // On envoie les propriétés du carré mises à jour à TOUS les clients
      ioServer.emit("updateClientSquare", square);
    });


    ioSocket.on("disconnect", function() {
      delete allSquares[square.id];
      ioServer.emit("youLoose",  { message: "sorry you loose"})
      ioServer.emit("deleteClientSquare", square);
    });

    
  });

  
});
