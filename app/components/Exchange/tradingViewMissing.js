// Stand-in for charting_library/charting_library.esm.js when the licensed
// TradingView library is not installed (see webpack.config.js). It has no
// `widget`, which is how ExchangePriceChart knows to use the built-in chart.
module.exports = {};
