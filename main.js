const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const moment = require('moment')
const io = require('socket.io')(server, {
    cors: { origin: '*' }
})
const Tesseract = require('tesseract.js');
const multer = require('multer');
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const port = 3000
const adapter = new FileSync('db.json')
const db = low(adapter)

const storage = multer.memoryStorage();
const upload = multer({ storage });
db.defaults({ Login: [], User: [], XeTrongXuong: [], XeDaGiao: [],ThongTinXe:[] }).write();

io.on('connection', async (socket) => {
    console.log('Client connected', socket.id);
    socket.on('login', async (data) => {
        let User = await db.get('User').find({ user: data.user, password: data.password }).value();
        if (User) {
            let loginuse = { id: socket.id, fullname: User.fullname, job: User.job }
            console.log(`${User.fullname} Đã Đăng Nhập`);
            await db.get("Login").push(loginuse).write()
            readId('XeTrongXuong')
                .then((data) => {
                    io.to(`${socket.id}`).emit('DangNhapThanhCong', User.fullname);
                    io.to(`${socket.id}`).emit('sendData', data);
                })
        }
        else {
            io.to(`${socket.id}`).emit('error', { message: "Sai thông tin đăng nhập" });
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
    socket.on("dangkyhen", async (data) => {
        CheckLogin(socket.id)
            .then(async (res) => {
                const newId = getLastId(data.path) + 1
                let iddata = await db.get(data.path).find({ id: data.data.id }).value();
                if (!iddata) {
                    if (!data.data.id) { data.data.id = newId }
                    data.data['Nhân Viên Hẹn'] = res.fullname;
                    data.data.LastUser = res.fullname;
                    data.data["TĐ Đặt Hẹn"] = moment().format("YYYY-MM-DD HH:mm");
                    data.data["Khách Hẹn"] = true;
                    db.get(data.path).push(data.data).write();
                    io.emit('sendData', db.get(data.path).value());
                    io.to(`${socket.id}`).emit('thanhcong', `Đã Đăng Ký ${data.data['Biển Số Xe']}`);
                    let sendDT = getSockid("Đặt Hẹn");
                    sendDT.forEach(element => {
                        if (element.id != socket.id) {
                            io.to(`${element.id}`).emit('DangKyMoi', { message: "Đăng Ký Xe", user: res.fullname, XeDangKy: data.data['Biển Số Xe'] });
                        }
                    });
                } else {
                    io.to(`${socket.id}`).emit('error', { message: "Xe Đã Đăng Ký" });
                }
            })
            .catch((error) => {
                io.to(`${socket.id}`).emit('error', error);
                console.log(error);
            })
    });

    socket.on("capnhathen", async (data) => {
        CheckLogin(socket.id)
            .then(async (res) => {
                data.data.LastUser = res.fullname
                updateId(data.path, data.data.id, data.data)
                    .then((resdata) => {
                        io.emit('sendData', db.get(data.path).value());
                        io.to(`${socket.id}`).emit('thanhcong', `Đã cập nhật ${data.data['Biển Số Xe']}`);
                    })
            })
            .catch((error) => {
                io.to(`${socket.id}`).emit('error', error);
                console.log(error);
            })
    });

    socket.on("dangkyletan", async (data) => {
        CheckLogin(socket.id)
            .then(async (res) => {
                data.data.LastUser = res.fullname;
                data.data["TĐ Gặp Lễ Tân"] = moment().format("YYYY-MM-DD HH:mm")
                data.data["Trạng Thái Xưởng"] = "02 Chờ Tiếp Nhận";
                let findata = db.get(data.path).find({ id: data.data.id }).value()
                if(findata){
                    await  db.get(data.path).find({ id: data.data.id }).assign(data.data).write();
                    let res = await db.get(data.path).find({ id: data.data.id }).value()
                     io.emit('sendData', db.get(data.path).value());
                     io.to(`${socket.id}`).emit('thanhcong', `Đã Đăng Ký LT ${res['Biển Số Xe']}`);
                }else{
                    db.get(data.path).push(data.data).write();
                    let res = await db.get(data.path).find({ id: data.data.id }).value()
                    io.emit('sendData', db.get(data.path).value());
                    io.to(`${socket.id}`).emit('thanhcong', `Đã Đăng Ký LT ${res['Biển Số Xe']}`);
                }
            })
            .catch((error) => {
                io.to(`${socket.id}`).emit('error', error);
                console.log(error);
            })
    });
    socket.on("capnhatletan", async (data) => {
        CheckLogin(socket.id)
            .then(async (res) => {
                data.data.LastUser = res.fullname;
                updateId(data.path, data.data.id, data.data)
                    .then((resdata) => {
                        console.log(resdata);
                        io.emit('sendData', db.get(data.path).value());
                        io.to(`${socket.id}`).emit('thanhcong', `Đã Đăng Ký LT ${data.data['Biển Số Xe']}`);
                    })
            })
            .catch((error) => {
                io.to(`${socket.id}`).emit('error', error);
                console.log(error);
            })
    });


});//io
app.post('/ocr', upload.single('image'), async (req, res) => {
    try {
      const image = req.file.buffer;
      const result = await Tesseract.recognize(image, 'eng', {
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      });
      const licensePlate = result.data.text.trim();
      res.json({ licensePlate });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
server.listen(port, () => {
    console.log(`Server listening on port ${port}`);

});

function getSockid(Job) {
    var dbjob = db.get('Login').value()
    dbjob = dbjob.filter((r) => { return r.job == Job })
    return dbjob
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
function createId(path, data) {
    return new Promise(async (resolve, reject) => {
        if (!db.has(path).value()) {
            return reject('Collection is not exists!');
        }
        await db.get(path).push(data).write()
        const newObject = db.get(path).find({ id: data, id }).value();
        resolve(newObject);
    });
}

function updateId(path, id, data) {
    return new Promise(async (resolve, reject) => {
        if (!db.has(path).value()) {
            return reject('Collection is not exists!');
        }
        console.log(data)
        await db.get(path).find({ id: id }).assign(data).write();
        const refreshedObject = db.get(path).find({ id: id }).value();
        if (!refreshedObject) {
            createId(path, data).then(res => {
                resolve(res);
            })
        }
        console.log(refreshedObject);
        resolve(refreshedObject);
    });
}
function deleteId(path, id = null) {
    return new Promise(async (resolve, reject) => {
        if (!db.has(path).value()) {
            return reject('Collection is not exists!');
        }
        if (!id) { return reject('ID not provided!'); }
        await db.get(path).remove({ id: id }).write();
        resolve({ command: 'delete', id: id });
    });
}