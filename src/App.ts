import * as express from "express";
import * as logger from "morgan";
import * as bodyParser from "body-parser";
import * as passport from "passport";
import * as passportJWT from "passport-jwt";
import * as epimetheus from "epimetheus";
let mariadb = require("mariadb");
const request = require("request");

class App {
  public jwtOptions: any = {};
  public ExtractJwt = passportJWT.ExtractJwt;
  public JwtStrategy = passportJWT.ExtractJwt;
  public express: express.Application;
  public connectionString: any;
  public newdata: any = [];
  public pool: any;
  constructor() {
    this.jwtOptions.jwtFromRequest = this.ExtractJwt.fromAuthHeaderAsBearerToken();
    this.jwtOptions.secretOrKey = process.env.SECRET;
    this.connectionString = {
      host: process.env.HOST,
      user: process.env.UID,
      password: process.env.PASSWORD,
      database: process.env.DATABASE,
      connectionLimit: 5,
      port: process.env.PORT
    };
    this.pool = mariadb.createPool(this.connectionString);
    console.log(this.connectionString);
    this.express = express();
    epimetheus.instrument(this.express);
    this.middleware();
    this.routes();
  }
  private ensureToken(req, res, next) {
    const bearerHeader = req.headers["authorization"];
    if (typeof bearerHeader !== "undefined") {
      const bearer = bearerHeader.split(" ");
      const bearerToken = bearer[1];
      req.token = bearerToken;
      next();
    } else {
      res.sendStatus(403);
    }
  }
  private middleware(): void {
    this.express.use(function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "X-Requested-With,content-type"); 
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE"); 
      next();
    });
    this.express.use(logger("dev"));
    this.express.use(bodyParser.json());
    this.express.use(passport.initialize());
    this.express.use(bodyParser.urlencoded({ extended: false }));
  }
  private routes(): void {
    let router = express.Router();
    router.post("/book", this.ensureToken, (req, res, next) => {
      this.pool
        .getConnection()
        .then(conn => {
          conn
            .query(
              "INSERT INTO SAMPLE.Booking  ( Checkin, UserID, FlightID, OfferNamePricing, OfferTypePricing,\
                CostPricing, OfferNameUpgrade, OfferTypeUpgrade,CostNameUpgrade) \
                VALUES ('0', ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                req.body.UserID,
                req.body.FlightID,
                req.body.OfferNamePricing,
                req.body.OfferTypePricing,
                req.body.CostPricing,
                req.body.OfferNameUpgrade,
                req.body.OfferTypeUpgrade,
                req.body.CostUpgrade
              ]
            )
            .then(data => {
              conn.end();
              console.log(res);
              res.json({
                message: "sucesfully inserted"
              });
            })
            .catch(err => {
              conn.end();
              if (err) {
                res.status(404).json({ err });
                console.log(err);
              }
            });
        })
        .catch(err => {
          if (err) {
            res.status(404).json({ err });
            console.log(err);
          }
        });
    });

    router.get("/listBookingByUser/:id", this.ensureToken, (req, res, next) => {
      this.newdata = [];
      this.pool
        .getConnection()
        .then(conn => {
          conn
            .query("SELECT * FROM SAMPLE.Booking WHERE UserID=? ", [
              req.params.id
            ])
            .then(data => {
              conn.end();
              res.json(data);
            })
            .catch(err => {
              conn.end();
              if (err) {
                res.status(404).json({ err });
              }
            });
        })
        .catch(err => {
          if (err) {
            res.status(404).json({ err });
          }
        });
    });

    router.get("/delete", (req, res, next) => {
      this.pool
        .getConnection()
        .then(conn => {
          conn
            .query("DELETE FROM SAMPLE.Booking")
            .then(data => {
              conn.end();
              res.json({"msg":"success"});
            })
            .catch(err => {
              conn.end();
              if (err) {
                res.status(404).json({ err });
              }
            });
        })
        .catch(err => {
          if (err) {
            res.status(404).json({ err });
          }
        });
    });
    
    router.get(
      "/checkin/:bookid/:userid",
      this.ensureToken,
      (req, res, next) => {
        this.pool
          .getConnection()
          .then(conn => {
            conn
              .query(
                "UPDATE SAMPLE.Booking SET Checkin = '1' WHERE BookingID = ? AND UserID=? ",
                [req.params.bookid, req.params.userid]
              )
              .then(data => {
                conn.end();
                console.log(data);
                res.json({
                  message: "sucesfully inserted"
                });
              })
              .catch(err => {
                conn.end();
                if (err) {
                  res.status(404).json({ err });
                  console.log(err);
                }
              });
          })
          .catch(err => {
            if (err) {
              res.status(404).json({ err });
              console.log(err);
            }
          });
      }
    );
    router.get("/healthz", (req, res, next) => {
      res.send("success");
    });
    this.express.use("/", router);
  }
}
export default new App().express;
