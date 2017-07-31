const fs = require('fs');

const axios = require('axios');
const schedule = require('node-schedule');
const mpg123 = require('mpg123');
const { log, warn } = require('./logger.js');

const config = require('./config.json');

const HttpInstance = axios.create();
const Player = new mpg123.MpgPlayer();

Player.on('format', data => {
    fadeEffect();
})
function fadeEffect() {
    let count = 0;
    Player.volume(0);
    poll();
    function poll() {
        if (count > 50) return;
        Player.volume(count * 2);
        setTimeout(() => {
            count++;
            poll();
        }, 200)
    }
}

let responsiveObj = {
    cookieArray: [],
    set cookieArray(val) {
        // 自动带上 cookie
        HttpInstance.defaults.headers.Cookie = val.join(';');
        return val;
    }
}
responsiveObj.cookieArray = [1, 2, 3];
let currentDay = null;

// 每天早上 6 点刷新登录信息
schedule.scheduleJob('00 6 * * *', function() {
    freshLoginInfo();
});

// 登录
loginNetease()
    .then(() => {
        // 6.55 闹钟
        schedule.scheduleJob('55 6 * * *', function() {
            init();
        });
    })
    .catch(e => log(e));

function init() {
    currentDay = getCurrentDay();
    HttpInstance.get('https://sp0.baidu.com/8aQDcjqpAAV3otqbppnN2DJv/api.php', {
            params: {
                query: currentDay,
                co: '',
                resource_id: 6018,
                t: Date.now(),
                ie: 'utf8',
                oe: 'utf8',
                format: 'json',
                tn: 'baidu',
                _: Date.now()
            }
        })
        .then(res => {
            // 百度日历节假日没生成
            if (!res.data.data[0].holiday) {
                return log('节假日还未生成');
            };

            // 节假日 不闹钟
            if (isHoliday(currentDay, res.data.data[0].holiday)) {
                return log('今天是节假日，君请休息');
            };

            // 正常闹钟 获取网易云音乐每日推荐歌单的随机一首
            return getTargetMusicUrl();
        })
        .then(url => {
            if (url) {
                log(url);
                Player.play(url);
            }
        })
        .catch(e => warn(e))
}

function getCurrentDay() {
    const now = new Date().toLocaleString();
    const curArray = now.split(',')[0].split('/');
    return `${curArray[2]}年${curArray[1]}月${curArray[0]}日`;
}

function isHoliday(day, holidayList) {
    // 节假日日期
    let holidayResult = [];
    // 周末需上班日期
    let weekEndButWork = [];
    holidayList.forEach(item => {
        item.list.forEach(i => {
            if (i.status === '1') {
                holidayResult.push(i.date)
            } else {
                weekEndButWork.push(i.date);
            }
        })
    });
    if (holidayResult.indexOf(day) > -1) return true;
    if ((new Date(day).getDay() === 6 || new Date(day).getDay() === 0) && weekEndButWork.indexOf(day) === -1) return true;
    return false;
}

function loginNetease() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync('./.cookie')) {
            fs.readFile('./.cookie', ((err, data) => {
                if (err) return reject(err);
                responsiveObj.cookieArray = JSON.parse(data);
                resolve();
            }))
        } else {
            HttpInstance.get(`http://127.0.0.1:3000/login/cellphone?phone=${config.phone}&password=${config.password}`)
                .then(res => {
                    // 记住 cookie
                    let cur = [];
                    res.headers['set-cookie'].forEach(item => {
                        cur.push(item.split(';')[0]);
                    });
                    responsiveObj.cookieArray = cur;
                    fs.writeFile('./.cookie', JSON.stringify(cur), 'utf-8', () => {});
                    resolve();
                })
                .catch(e => reject(e))
        }
    });
}

function freshLoginInfo() {
    HttpInstance.get('http://127.0.0.1:3000/login/refresh')
        .then(res => {
            // 刷新登录信息
            log('刷新登录信息成功');
        });
}

function getTargetMusicUrl() {
    return new Promise((resolve, reject) => {
        HttpInstance.get('http://127.0.0.1:3000/recommend/songs')
            .then(res => {
                let song = res.data.recommend[(Math.random() * res.data.recommend.length).toFixed(0)];
                log(`当前播放: ${song.name} -- ${song.artists[0].name}`);
                return song.id;
            })
            .then(songID => {
                return HttpInstance.get(`http://127.0.0.1:3000/music/url?id=${songID}`)
            })
            .then(res => {
                resolve(res.data.data[0].url);
            })
            .catch(e => reject(e));
    })
}