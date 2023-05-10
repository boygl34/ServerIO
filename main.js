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
        let User = await db.get('User').find({ user: data.user, password: data.password }).value();
        if (User) {
            let loginuse = { id: socket.id, fullname: User.fullname, job: User.job }
            await db.get("Login").push(loginuse).write()
            io.to(`${socket.id}`).emit('DangNhap', User.fullname);
            io.to(`${socket.id}`).emit('sendData', db.get('XeTrongXuong').value());
        }
        else {
            io.to(`${socket.id}`).emit('error', { message: "Sai thông tin đăng nhập" });
        }
    });
    socket.on("disconnect", async () => {
        try {
            db.get('Login').remove({ id: socket.id }).write()
            console.log('Client disconnect', socket.id);
        }
        catch (error) {
            console.log("Không tìm thấy ID")
        }
    });

    socket.on("dangky", async (data) => {
        try {
            let User = await db.get('Login').find({ id: socket.id }).value();
            if (User) {
                const newId = getLastId(data.path) + 1
                let iddata = await db.get(data.path).find({ id: data.data.id }).value()
                if (!iddata) {
                    if (!data.data.id) { data.data.id = newId }
                    data.data.LastUser = User.fullname
                    db.get(data.path).push(data.data).write()
                    io.emit('sendData', db.get(data.path).value());
                    io.to(`${socket.id}`).emit('thanhcong', `Đã Đăng Ký ${data.data['Biển Số Xe']}`);
                } else {
                    io.to(`${socket.id}`).emit('error', { message: "Xe Đã Đăng Ký" });
                }
            } else {
                io.to(`${socket.id}`).emit('error', { message: "Bạn Chưa Đăng Nhập" });
            }
        }
        catch (error) {
            io.to(`${socket.id}`).emit('error', { message: "Không Thể Đăng Ký" });
        }
    });
    socket.on('capnhat', async (data) => {
        try {
            if (!db.has(data.path).value()) {
                io.to(`${socket.id}`).emit('error', { message: "Không Tìm Thấy Thông Tin" });
            }
            let User = await db.get('Login').find({ id: socket.id }).value();
            if (User) {
                data.data.LastUser = User.fullnames
                await db.get(data.path).find({ id: data.id }).assign(data.data).write();
                io.emit('sendData', db.get(data.path).value());
                io.to(`${socket.id}`).emit('thanhcong', `Đã cập nhật ${data.data['Biển Số Xe']}`);
            } else {
                io.to(`${socket.id}`).emit('error', { message: "Bạn Chưa Đăng Nhập" });
            }
        } catch (error) {
            io.to(`${socket.id}`).emit('error', { message: "Không Thể Cập Nhật" });
        }
    })




});





server.listen(port, () => {
    console.log(db.data);
    console.log(`Server listening on port ${port}`);

});


function getLastId(path) {
    if (db.has(path).value()) {
        let sorted = db.get(path)
            .value()
            .sort((a, b) => {
                return b.id - a.id;
            });

        return sorted[0] ? sorted[0].id : 1;
    }
    return 1;
} 