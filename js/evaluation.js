/**
 * all the custom
 * @author github/roest01
 * @author github/joelvaneenwyk
 */

const ButtonHelper = function (btn) {
    const button = jQuery(btn);
    this.loading = function () {
        button.html(button.data("loading-text"));
    };

    this.reset = function () {
        button.html(button.data("original-text"));
    };
};

// eslint-disable-next-line prefer-const
let appConfig = {
    customTitle: "Speedtest Statistics v1.4.3",
    dateFormat: "YYYY.MM.DD",
    locale: "en",
    labels: {
        download: "Download",
        ping: "Ping",
        upload: "Upload"
    },
    _chart: null,
    daterange: {
        timePicker: true,
        timePicker24Hour: true,
        startDate: moment().subtract(1, "month"),
        endDate: moment().endOf("day"),
        ranges: {
            Today: [moment().hours(0).minutes(0).seconds(0), moment().hours(23).minutes(59).seconds(59)],
            Yesterday: [
                moment().hours(0).minutes(0).seconds(0)
                    .subtract(1, "days"),
                moment().hours(23).minutes(59).seconds(59)
                    .subtract(1, "days")
            ],
            "Last 7 Days": [moment().subtract(6, "days"), moment()],
            "Last 30 Days": [moment().subtract(29, "days"), moment()],
            "This Month": [moment().startOf("month"), moment().endOf("month")],
            "Last Month": [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")]
        }
    }
};

$.getScript("data/config.js")
    .done(function (script, textStatus) {
        console.log(`Loaded custom configuration. Status: '${textStatus}'`);
    })
    .fail(function () {
        console.log("No custom configuration available."); // 200
    });

jQuery(document).ready(function () {
    const colors = {
        orange: "rgba(255,190,142,0.5)",
        black: "rgba(90,90,90,1)",
        green: "rgba(143,181,178,0.8)"
    };

    if (appConfig.customTitle) {
        jQuery("#title").html(appConfig.customTitle);
    }

    const data = {
        labels: [],
        datasets: [
            {
                label: appConfig.labels.ping,
                isMB: false,
                fill: false,
                backgroundColor: colors.black,
                borderColor: colors.black,
                tension: 0
            },
            {
                label: appConfig.labels.upload,
                isMB: true,
                fill: false,
                backgroundColor: colors.green,
                borderColor: colors.green,
                tension: 0
            },
            {
                label: appConfig.labels.download,
                isMB: true,
                fill: true,
                backgroundColor: colors.orange,
                borderColor: colors.orange,
                tension: 0
            }
        ]
    };

    const chartDom = jQuery("#speedChart").get(0).getContext("2d");
    const chartJS = new Chart(chartDom, {
        type: "line",
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            tooltips: {
                mode: "index",
                intersect: false,
                callbacks: {
                    label(item) {
                        if (data.datasets[item.datasetIndex].isMB) {
                            return `${data.datasets[item.datasetIndex].label}: ${item.yLabel} MBits/s`;
                        }
                        return `${data.datasets[item.datasetIndex].label}: ${item.yLabel}`;
                    }
                }
            },
            hover: {
                mode: "nearest",
                intersect: true
            },
            multiTooltipTemplate: `
<%if (datasetLabel){%>
    <%=datasetLabel%>:
<%}%>
<%= value %>
<%if (datasetLabel != appConfig.labels.ping)
{%>
    MBits/s
<%}%>`
        }
    });

    const ParseManager = function () {
        const parseManager = this;
        parseManager.header = null;
        parseManager._startDate = null;
        parseManager._endDate = null;
        parseManager._chart = null;
        parseManager.i = 0;
        parseManager.uploadCount = 0;
        parseManager.downloadCount = 0;

        /**
         * parse result.csv and create graph with _startDate and _endDate filter
         */
        parseManager.parse = function () {
            const parseManager = this;
            parseManager.i = 0;

            Papa.parse("data/result.csv", {
                download: true,
                step(row) {
                    // using stream to allow huge file progressing
                    parseManager.i += 1;
                    const dataArr = row.data;

                    if (!parseManager.header || parseManager.i === 1) {
                        parseManager.header = dataArr;
                    } else {
                        // build csv array
                        const measureRow = [];
                        for (let i = 0; i < dataArr.length; i += 1) {
                            measureRow[parseManager.header[i]] = dataArr[i];
                        }
                        measureRow.timestamp_s = parseInt(measureRow.timestamp / 1000); // from ms timestamp to seconds
                        measureRow.timestamp = parseInt(measureRow.timestamp); // from save ms timestamp

                        if (!!parseManager._startDate && !!parseManager._endDate) {
                            if (
                                measureRow.timestamp_s < parseManager._startDate.unix()
                                || measureRow.timestamp_s > parseManager._endDate.unix()
                            ) {
                                // not in filter
                                return;
                            }
                        }

                        parseManager.addRow(measureRow);
                    }
                }
            });
        };

        /**
         * add a row to chart
         *
         * @param measureRow
         */
        parseManager.addRow = function (measureRow) {
            const chart = parseManager._chart;
            const chartData = chart.config.data;
            chartData.labels.push(this.getDateFromData(measureRow));

            if (parseFloat(measureRow.upload) > parseFloat(measureRow.download)) {
                parseManager.uploadCount += 1;
            } else {
                parseManager.downloadCount += 1;
            }

            chartData.datasets[0].data.push(measureRow.ping);
            chartData.datasets[1].data.push(measureRow.upload);
            chartData.datasets[2].data.push(measureRow.download);

            /**
             * graph has to be filled dynamically whether upload or download is higher. See issue #10
             */
            const total = parseManager.uploadCount + parseManager.downloadCount;
            let largerValue = 0;
            if (parseManager.uploadCount > parseManager.downloadCount) {
                chartData.datasets[1].fill = "+1"; // fill upload till download line
                chartData.datasets[2].fill = "origin";
                largerValue = parseManager.uploadCount;
            } else {
                // upload lower than download -> priority for upload
                chartData.datasets[1].fill = "origin";
                chartData.datasets[2].fill = "-1"; // fill download starting @ upload line
                largerValue = parseManager.downloadCount;
            }

            const percentDominated = (largerValue * 100) / total;
            if (percentDominated < 70) {
                // threshold
                // no fill for upload because more than 30% overlapping
                chartData.datasets[1].fill = false;
                chartData.datasets[2].fill = true;
            }

            parseManager._chart.config.data = chartData;
            chart.update();
        };

        parseManager.flushChart = function (force, callback) {
            const parseManager = this;
            const chart = parseManager._chart;

            parseManager.uploadCount = 0;
            parseManager.downloadCount = 0;

            chart.data.labels = [];
            chart.data.datasets.forEach(function (dataSet) {
                dataSet.data = [];
            });

            parseManager._chart.update();
            callback();
            return true;
        };

        parseManager.getDateFromData = function (measureRow) {
            return moment(new Date(measureRow.timestamp)).format("L - LT");
        };

        /**
         * set start date as filter
         *
         * @param startDate
         * @returns {ParseManager}
         */
        parseManager.setStartDate = function (startDate) {
            parseManager._startDate = startDate;
            return parseManager;
        };

        /**
         * set end date as filter
         *
         * @param endDate
         * @returns {ParseManager}
         */
        parseManager.setEndDate = function (endDate) {
            parseManager._endDate = endDate;
            return parseManager;
        };

        /**
         *
         * @param chart {*|e}
         * @returns {ParseManager}
         */
        this.setChart = function (chart) {
            this._chart = chart;
            return this;
        };

        /**
         * set a new filter and update the graph
         *
         * @param startDate
         * @param endDate
         */
        this.update = function (startDate, endDate) {
            const parseManager = this;
            parseManager._startDate = startDate;
            parseManager._endDate = endDate;

            parseManager.flushChart(true, function () {
                parseManager.parse();
            });
        };
    };

    const daterangeConfig = {
        locale: {
            format: appConfig.dateFormat
        },
        autoApply: true,
        opens: "left"
    };

    jQuery.extend(daterangeConfig, appConfig.daterange);

    // init application
    jQuery(document).ready(function () {
        const parseManager = new ParseManager();
        parseManager.setChart(chartJS);
        const dateRange = jQuery("input[name='daterange']");
        dateRange.daterangepicker(daterangeConfig, function (start, end) {
            parseManager.update(start, end);
        });

        moment.locale(appConfig.locale);

        if (appConfig.daterange.startDate && appConfig.daterange.endDate) {
            parseManager.setStartDate(appConfig.daterange.startDate).setEndDate(appConfig.daterange.endDate);
        }
        parseManager.parse();

        jQuery("#startSpeedtest").click(function () {
            const buttonHelper = new ButtonHelper(this);

            buttonHelper.loading();

            jQuery.get("/run_speedtest", function () {
                buttonHelper.reset();
                parseManager.flushChart(true, function () {
                    parseManager.parse();
                });
            });
        });
    });
});
