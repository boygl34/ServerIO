const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const moment = require('moment')
const io = require('socket.io')(server, {
    cors: { origin: '*' }
})
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const { log } = require('console')
const port = 3000
const adapter = new FileSync('db.json')
const db = low(adapter)
db.defaults({ Login: [], User: [], XeTrongXuong: [], XeDaGiao: [], ThongTinXe: [] }).write();

io.on('connection', async (socket) => {
    console.log('Client connected', socket.id);
    socket.on('login', async (data) => {
        let User = await db.get('User').find({ user: data.user, password: data.password }).value();
        if (User) {
            let loginuse = { id: socket.id, fullname: User.fullname, job: User.job ,name:User.name}
            console.log(`${User.fullname} Đã Đăng Nhập`);
            await db.get("Login").push(loginuse).write()
            readId('XeTrongXuong')
                .then((data) => {
                    io.to(`${socket.id}`).emit('DangNhapThanhCong', loginuse);
                    io.to(`${socket.id}`).emit('sendData', data);
                })
        }
        else {
            io.to(`${socket.id}`).emit('KhongKetNoi', "Sai Thông Tin Đăng Ngập");
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
    socket.on("create", async (data) => {
        CheckLogin(socket.id)
            .then(async (res) => {
                const newId = getLastId(data.path) + 1
                let iddata = await db.get(data.path).find({ id: data.data.id }).value();
                console.log(iddata);
                if (!iddata) {
                    if (!data.data.id) { data.data.id = newId }
                    await db.get(data.path).push(Object.assign(data.data,await LayThongTin(data.data.id))).write();
                    io.emit('sendData', db.get(data.path).value());
                    io.to(`${socket.id}`).emit('thanhcong', {message:`Đã Đăng Ký ${data.data['Biển Số Xe']}`});
                } else {
                    io.to(`${socket.id}`).emit('error', { message: "Xe Đã Đăng Ký" });
                }
            })
            .catch((error) => {
                console.log(error);
                io.to(`${socket.id}`).emit('error', error);
            })
    });
    socket.on("update", async (data) => {
        CheckLogin(socket.id)
            .then(async (res) => {
                
                let iddata = await db.get(data.path).find({ id: data.data.id }).value();
                
                if (iddata) {
                    await db.get(data.path).find({ id: data.data.id }).assign(data.data).write()
                    io.emit('sendData', await db.get(data.path).value());
                    io.to(`${socket.id}`).emit('thanhcong',{ message:`Đã cập nhật ${data.data['Biển Số Xe']}`});
                } else {
                    io.to(`${socket.id}`).emit('error', { message: "Không tìm thấy thông tin" });
                }
            })
            .catch((error) => {
                io.to(`${socket.id}`).emit('error', error);
            })
    });
    socket.on("delete", async (data) => {
        CheckLogin(socket.id)
            .then(async (res) => {
                let iddata = await db.get(data.path).find({ id: data.data.id }).value();
                if (iddata) {
                    db.get(data.path).remove({ id: data.data.id }).write();
                    io.emit('sendData', db.get(data.path).value());
                    io.to(`${socket.id}`).emit('thanhcong', {message:`Đã xoá ${data.data['Biển Số Xe']}`});
                } else {
                    io.to(`${socket.id}`).emit('error', { message: "Xe Đã Đăng Ký" });
                }
            })
            .catch((error) => {
                io.to(`${socket.id}`).emit('error', error);
            })
    });
    socket.on("read", async (data) => {
        io.to(`${socket.id}`).emit('sendData', db.get(data.path).value());
    });

    socket.on("message", async (data) => {
        sendMessage(data.Job,data.Name,data.Message)
    });
    socket.on("ThongTinKH", async (data) => {
        let iddata = await db.get("ThongTinXe").find({ id: data.id }).value();
        let iddata2 = await db.get("XeTrongXuong").find({ id: data.id }).value();
        if(iddata2){
            await db.get("XeTrongXuong").find({ id: data.id }).assign(data).write()
        }
        if(iddata){
            await db.get("ThongTinXe").find({ id: data.id }).assign(data).write()
        }else{ 
            await db.get('ThongTinXe').push(data).write();
        }
       res= await db.get("ThongTinXe").find({ id: data.id }).value();
       io.to(`${socket.id}`).emit('thanhcong', {message:`Lưu Thông Tin ${res.id}`});
    });





});//io

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);

});

function sendMessage(Job,Name,Message) {
    var dbjob = db.get('Login').value()
    dbjob = dbjob.filter((r) => { return r.job == Job&&r.name == Name })
     dbjob.forEach(element => {
        io.to(`${element.id}`).emit('message', Message);
    });
}
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
async function CheckLogin(user) {
    return new Promise(async (resolve, reject) => {
        let User = await db.get('Login').find({ id: user }).value();
        resolve(User)
        reject({ message: "Lỗi Không Thấy User" })
    })
}
async function LayThongTin(bienso) {
    let res=await db.get('ThongTinXe').find({ id: bienso }).value();
    
    return res
}
async function LuuThongTin(data) {
    let res = db.get('ThongTinXe').find({ id: data.id }).value()
    if (res) {
        await db.get('ThongTinXe').find({ id: data.id }).assign(data).write()
    } else {
        db.get('ThongTinXe').push(data).write();
    }


}

function readId(path, id = null) {
    return new Promise((resolve, reject) => {
        let result = [];

        if (!db.has(path).value()) {
            return reject('Collection is not exists!');
        }

        if (!id) {
            result = db.get(path)
                .value()
                .sort((a, b) => a.id - b.id);
        } else {
            result = db.get(path)
                .find({ id: id })
                .value();
        }

        resolve(result);
    });
}