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


io.on('connection', async (socket) => {
 
console.log('Client connected', socket.id);

    socket.on('login', async (data) => {
            let user = { name: data.name, id: socket.id }
            db.get('Login').push(user).write()
            io.to(`${ socket.id}`).emit('login', socket.id);     
            io.to(`${ socket.id}`).emit('sendData', db.get('XeTrongXuong').value());      
    });
    socket.on("disconnect", async () => {
        try{
            db.get('Login').remove({ id: socket.id }).write()
            console.log('Client disconnect', socket.id);}
        catch(error){
            console.log("Không tìm thấy ID")
        }
    });

    socket.on("dangky", async (data) => {
        try{
            const newId = getLastId(data.path) + 1
            let  User = await db.get('Login').find({ id: socket.id }).value();
            if(!data.data.id){data.data.id = newId}
            data.data.LastUser = User.name
            await db.get(data.path).push(data.data).write()
            io.emit('sendData', db.get(data.path).value()); 
        }
        catch(error){
            console.log(error);
            io.to(`${ socket.id}`).emit('error', {message:"Không Thể Đăng Ký"}); 
        }
    });


});





server.listen(port, () => {
    console.log(db.data);
    console.log(`Server listening on port ${port}`);

});


  function  getLastId(path) {
    if (  db.has(path).value()) {
        let sorted =  db.get(path)
            .value()
            .sort( (a, b) => {
                return b.id - a.id;
            });
        
        return sorted[0] ? sorted[0].id : 1;
    }
    return 1;
} 