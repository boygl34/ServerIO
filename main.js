const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const io = require('socket.io')(server, {
    cors: { origin: '*' }
})
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const port = 3000
const adapter = new FileSync('db.json')
const db = low(adapter)



console.log('ád', db.get('Login').value());

// const io = new io.Server(server, {
//     cors: { origin: '*' }
// });

//const { Login, XeTrongXuong, XeDaGiao } = db.data
io.on('connection', async (socket) => {

    console.log('Client connected', socket.id);
    socket.on('login', async (data) => {
        let user = { name: data.name, id: socket.id }
        db.get('Login')
            .push(user)
            .write()
        socket.emit("sendData", db.get('XeTrongXuong').value())
    });
    socket.on("disconnect", async () => {

        console.log('Client disconnect', socket.id);
    });


});





server.listen(port, () => {
    console.log(db.data);
    console.log(`Server listening on port ${port}`);

});