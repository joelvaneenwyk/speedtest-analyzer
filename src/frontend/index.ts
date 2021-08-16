/**
 * all the custom
 * @author github/roest01
 * @author github/joelvaneenwyk
 */

import "./scss/home.scss";

// You can specify which plugins you need
import $ from "jquery";
import moment from "moment";
import Chart from "chart.js";
import Papa from "papaparse";
import daterangepicker from "daterangepicker";

class ButtonHelper {
    button: JQuery<HTMLElement>;

    constructor(element: JQuery<HTMLElement>) {
        this.button = element;
    }

    loading() {
        $(this.button).html($.data(this.button, "loading-text"));
    }

    reset() {
        $(this.button).html($.data(this.button, "original-text"));
    }
}

class MeasureRow {
    timestamp: number = 0;
    ping: number = 0;
    download: number = 0;
    upload: number = 0;
    timestamp_s: number = 0;

    constructor(header: string[], data: string[]) {
        for (let i = 0; i < data.length; i += 1) {
            const dataName = header[i];
            if (dataName == "timestamp") {
                // from save ms timestamp
                this.timestamp = parseInt(data[i]);

                // from ms timestamp to seconds
                this.timestamp_s = this.timestamp / 1000;
            } else if (dataName == "ping") {
                this.ping = parseFloat(data[i]);
            } else if (dataName == "download") {
                this.download = parseFloat(data[i]);
            } else if (dataName == "upload") {
                this.upload = parseFloat(data[i]);
            }
        }
    }
}

class ParseManager {
    header: string[] = [];
    _startDate: moment.Moment = moment();
    _endDate: moment.Moment = moment();
    _chart: Chart.Chart | null = null;
    i: number = 0;
    uploadCount: number = 0;
    downloadCount: number = 0;

    _parseRow() {}
    /**
     * parse result.csv and create graph with _startDate and _endDate filter
     */
    parse() {
        this.i = 0;

        let parseManager = this;

        Papa.parse("data/result.csv", {
            download: true,
            step(row: Papa.ParseResult<string>) {
                parseManager.i += 1;

                const dataArr: string[] = row.data;

                if (!parseManager.header || parseManager.i === 1) {
                    parseManager.header = dataArr;
                } else {
                    // Build csv array
                    const measureRow: MeasureRow = new MeasureRow(parseManager.header, dataArr);

                    if (!!parseManager._startDate && !!parseManager._endDate) {
                        if (
                            measureRow.timestamp_s < parseManager._startDate.unix() ||
                            measureRow.timestamp_s > parseManager._endDate.unix()
                        ) {
                            // Not in filter
                            return;
                        }
                    }

                    parseManager.addRow(measureRow);
                }
            }
        });
    }

    /**
     * add a row to chart
     *
     * @param measureRow
     */
    addRow(measureRow: any) {
        if (this._chart != null && this._chart.config.data.labels !== undefined) {
            const chartData = this._chart.config.data;
            const dataSets = chartData.datasets as Chart.ChartDataset<"line">[];

            this._chart.config.data.labels.push(this.getDateFromData(measureRow));

            if (parseFloat(measureRow.upload) > parseFloat(measureRow.download)) {
                this.uploadCount += 1;
            } else {
                this.downloadCount += 1;
            }

            dataSets[0].data.push(measureRow.ping);
            dataSets[1].data.push(measureRow.upload);
            dataSets[2].data.push(measureRow.download);

            /**
             * graph has to be filled dynamically whether upload or download is higher. See issue #10
             */
            const total = this.uploadCount + this.downloadCount;
            let largerValue = 0;
            if (this.uploadCount > this.downloadCount) {
                dataSets[1].fill = "+1"; // fill upload till download line
                dataSets[2].fill = "origin";
                largerValue = this.uploadCount;
            } else {
                // upload lower than download -> priority for upload
                dataSets[1].fill = "origin";
                dataSets[2].fill = "-1"; // fill download starting @ upload line
                largerValue = this.downloadCount;
            }

            const percentDominated = (largerValue * 100) / total;
            if (percentDominated < 70) {
                // threshold
                // no fill for upload because more than 30% overlapping
                dataSets[1].fill = false;
                dataSets[2].fill = true;
            }

            this._chart.config.data = chartData;
            this._chart.update();
        }
    }

    flushChart(force: boolean, callback: any) {
        this.uploadCount = 0;
        this.downloadCount = 0;

        if (this._chart != null) {
            this._chart.data.labels = [];
            this._chart.data.datasets.forEach(function (dataSet) {
                dataSet.data = [];
            });

            this._chart.update();
        }

        callback();
        return true;
    }

    getDateFromData(measureRow: MeasureRow) {
        return moment(new Date(measureRow.timestamp)).format("L - LT");
    }

    /**
     * set start date as filter
     *
     * @param startDate
     * @returns {ParseManager}
     */
    setStartDate(startDate: moment.MomentInput) {
        this._startDate = moment(startDate);
        return this;
    }

    /**
     * set end date as filter
     *
     * @param endDate
     * @returns {ParseManager}
     */
    setEndDate(endDate: moment.MomentInput) {
        this._endDate = moment(endDate);
        return this;
    }

    /**
     *
     * @param chart {*|e}
     * @returns {ParseManager}
     */
    setChart(chart: Chart.Chart | null) {
        this._chart = chart;
        return this;
    }

    /**
     * set a new filter and update the graph
     *
     * @param startDate
     * @param endDate
     */
    update(startDate: any, endDate: any) {
        this._startDate = startDate;
        this._endDate = endDate;
        this.flushChart(true, () => this.parse());
    }
}

class AppConfigLabels {
    download: string = "Download";
    ping: string = "Ping";
    upload: string = "Upload";
}

class AppConfig {
    customTitle: string = "";
    dateFormat: string = "YYYY.MM.DD";
    locale: string = "en";
    labels: AppConfigLabels = new AppConfigLabels();
    _chart: Chart.Chart | null = null;
    daterange: daterangepicker.Options | null = null;
}

let appConfig = new AppConfig();

$(function () {
    appConfig.customTitle = "Speedtest Statistics v1.4.3";
    appConfig.daterange = {
        timePicker: true,
        timePicker24Hour: true,
        startDate: moment().subtract(1, "month"),
        endDate: moment().endOf("day"),
        ranges: {
            Today: [moment().hours(0).minutes(0).seconds(0), moment().hours(23).minutes(59).seconds(59)],
            Yesterday: [
                moment().hours(0).minutes(0).seconds(0).subtract(1, "days"),
                moment().hours(23).minutes(59).seconds(59).subtract(1, "days")
            ],
            "Last 7 Days": [moment().subtract(6, "days"), moment()],
            "Last 30 Days": [moment().subtract(29, "days"), moment()],
            "This Month": [moment().startOf("month"), moment().endOf("month")],
            "Last Month": [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")]
        }
    };

    $.getScript("data/config.js")
        .done(function (script: any, textStatus: any) {
            console.log(`Loaded custom configuration. Status: '${textStatus}'`);
        })
        .fail(function () {
            console.log("No custom configuration available."); // 200
        });

    const colors = {
        orange: "rgba(255,190,142,0.5)",
        black: "rgba(90,90,90,1)",
        green: "rgba(143,181,178,0.8)"
    };

    if (appConfig.customTitle) {
        $("#title").html(appConfig.customTitle);
    }

    const data: Chart.ChartData<"line"> = {
        labels: [],
        datasets: [
            {
                label: appConfig.labels.ping,
                fill: false,
                backgroundColor: colors.black,
                borderColor: colors.black,
                tension: 0
            },
            {
                label: appConfig.labels.upload,
                //isMB: true,
                fill: false,
                backgroundColor: colors.green,
                borderColor: colors.green,
                tension: 0
            },
            {
                label: appConfig.labels.download,
                //isMB: true,
                fill: true,
                backgroundColor: colors.orange,
                borderColor: colors.orange,
                tension: 0
            }
        ] as Chart.ChartDataset<"line">[]
    };

    const chartCanvas = <HTMLCanvasElement>$("#speedChart").get(0);
    const chartDom = chartCanvas.getContext("2d");
    let chartJS: Chart.Chart | null = null;

    if (chartDom != null) {
        chartJS = new Chart.Chart(chartDom, {
            type: "line",
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                //tooltips: {
                //    mode: "index",
                //    intersect: false,
                //    callbacks: {
                //        label(item: any) {
                //            if (data.datasets[item.datasetIndex].isMB) {
                //                return `${data.datasets[item.datasetIndex].label}: ${item.yLabel} MBits/s`;
                //            }
                //            return `${data.datasets[item.datasetIndex].label}: ${item.yLabel}`;
                //        }
                //    }
                //},
                hover: {
                    mode: "nearest",
                    intersect: true
                }
                //multiTooltipTemplate: `
                // <%if (datasetLabel){%>
                //     <%=datasetLabel%>:
                // <%}%>
                // <%= value %>
                // <%if (datasetLabel != appConfig.labels.ping)
                // {%>
                //     MBits/s
                // <%}%>`
            }
        });
    }

    const daterangeConfig: daterangepicker.Options = {
        locale: {
            format: appConfig.dateFormat
        },
        autoApply: true,
        opens: "left"
    };

    $.extend(daterangeConfig, appConfig.daterange);

    // init application
    $(function () {
        const parseManager = new ParseManager();

        parseManager.setChart(chartJS);

        const dateRange = $("input[name='daterange']");

        dateRange.daterangepicker(daterangeConfig, function (start: any, end: any) {
            parseManager.update(start, end);
        });

        moment.locale(appConfig.locale);

        if (appConfig.daterange != null && appConfig.daterange.startDate && appConfig.daterange.endDate) {
            parseManager.setStartDate(appConfig.daterange.startDate).setEndDate(appConfig.daterange.endDate);
        }
        parseManager.parse();

        const buttonStartSpeedtest = $("#startSpeedtest");
        buttonStartSpeedtest.on("click", function () {
            const buttonHelper = new ButtonHelper(buttonStartSpeedtest);

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
