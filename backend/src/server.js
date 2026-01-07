import express from 'express';
import path from 'path';
import { ENV  } from './config/env.js';

const app = express();

const __dirname = path.resolve();

app.get("/api/health", (req, res) => {
    res.status(200).json({ message: "Success"});
});

//make our app ready for deployment
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../admin/dist')));

    app.get('/{*any}', (req, res) => {
        res.sendFile(path.join(__dirname, "../admin/dist/index.html"));
    });
}

app.listen(3000, () => console.log("Server is up and running"));