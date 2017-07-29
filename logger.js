const chalk = require('chalk');

const prefix = 'AlarmClock';
const sep = ' ';

const proxy = ['log', 'warn', 'error'];

const exportObj = {};

proxy.forEach(item => {
	exportObj[item] = function funcName(...args) {
		return console[item].call(this, chalk.white(item) + ' ' + chalk.bold.green((new Date()).toLocaleString()) + sep + args[0], args[1] || '');
	};
});

module.exports = exportObj;
