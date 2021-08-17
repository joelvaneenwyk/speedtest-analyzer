/**
 * all the custom
 * @author github/roest01
 * @author github/joelvaneenwyk
 */

import "./scss/home.scss";

// You can specify which plugins you need
import $ from "jquery";
import moment from "moment";
import { Chart, ChartDataset, ChartData, registerables } from "chart.js";
import "chartjs-adapter-moment";
import zoomPlugin from "chartjs-plugin-zoom";
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
    time: moment.Moment = moment();

    constructor(header: string[], data: string[]) {
        for (let i = 0; i < data.length; i += 1) {
            const dataName = header[i];
            if (dataName == "timestamp") {
                // from save ms timestamp
                this.timestamp = parseInt(data[i]);
                this.time = moment(this.timestamp, "X");
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
    _startDate: moment.Moment | undefined = undefined;
    _endDate: moment.Moment | undefined = undefined;
    _chart: Chart | null = null;
    i: number = 0;
    uploadCount: number = 0;
    downloadCount: number = 0;

    /**
     * parse result.csv and create graph with _startDate and _endDate filter
     */
    parse(input: string = "data/result.csv", download: boolean = true) {
        this.i = 0;

        let parseManager = this;

        Papa.parse(input, {
            download: download,

            error(error: Papa.ParseError) {
                console.log("Failed to load data.");

                // timestamp,ping,download,upload
                // 1622003836030.828,20.31,87.7,2.29
                // 1622004027043.011,21.01,86.2,2.72
                // 1622004114406.986,22.48,85.9,2.29
                // 1622005257000.246,24.42,78.7,1.90

                let today: moment.Moment = moment();
                let time = moment().subtract(20, "d");
                let csvData: string = "timestamp,ping,download,upload\n";

                while (time.isBefore(today)) {
                    let timestamp = moment(time)
                        .add(Math.random() * 60 * 12, "m")
                        .unix();
                    let ping = Math.random() * 50 + 10;
                    let download = Math.random() * 500 + 10;
                    let upload = Math.random() * 30 + 10;
                    csvData += `${timestamp.toString()},${ping},${download},${upload}\n`;
                    time = time.add(1, "d");
                }

                console.log(csvData);
                parseManager.parse(csvData, false);
            },
            step(row: Papa.ParseResult<string>) {
                parseManager.i += 1;

                const dataArr: string[] = row.data;

                if (!parseManager.header || parseManager.i === 1) {
                    parseManager.header = dataArr;
                } else {
                    // Build csv array
                    const measureRow: MeasureRow = new MeasureRow(parseManager.header, dataArr);

                    console.log(`${measureRow.timestamp.toString()} ${measureRow.time.toString()}`);
                    if (
                        parseManager._startDate == undefined ||
                        parseManager._endDate == undefined ||
                        (measureRow.time.isAfter(parseManager._startDate) && measureRow.time.isBefore(parseManager._endDate))
                    ) {
                        parseManager.addRow(measureRow);
                    }
                }
            },
            complete(results: Papa.ParseResult<string>) {
                parseManager._chart?.update();
            }
        });
    }

    /**
     * add a row to chart
     *
     * @param measureRow
     */
    addRow(measureRow: MeasureRow) {
        if (this._chart != null && this._chart.config.data.labels !== undefined) {
            const chartData = this._chart.config.data;
            const dataSets = chartData.datasets as ChartDataset<"line">[];

            this._chart.config.data.labels.push(measureRow.time);

            if (measureRow.upload > measureRow.download) {
                this.uploadCount += 1;
            } else {
                this.downloadCount += 1;
            }

            dataSets[0].data.push(measureRow.ping);
            dataSets[1].data.push(measureRow.upload);
            dataSets[2].data.push(measureRow.download);

            /**
             * Graph has to be filled dynamically whether upload or download is higher.
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
                //Threshold: No fill for upload because more than 30% overlapping
                dataSets[1].fill = false;
                dataSets[2].fill = true;
            }

            this._chart.config.data = chartData;
            //this._chart.update();
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

            this._chart.update(force ? "none" : "normal");
        }

        callback();

        return true;
    }

    /**
     * set start date as filter
     *
     * @param startDate
     * @returns {ParseManager}
     */
    setStartDate(startDate: moment.MomentInput): ParseManager {
        this._startDate = moment(startDate);
        return this;
    }

    /**
     * set end date as filter
     *
     * @param endDate
     * @returns {ParseManager}
     */
    setEndDate(endDate: moment.MomentInput): ParseManager {
        this._endDate = moment(endDate);
        return this;
    }

    /**
     *
     * @param chart {*|e}
     * @returns {ParseManager}
     */
    setChart(chart: Chart | null): ParseManager {
        this._chart = chart;
        return this;
    }

    /**
     * set a new filter and update the graph
     *
     * @param startDate
     * @param endDate
     */
    update(startDate: moment.Moment, endDate: moment.Moment) {
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
    _chart: Chart | null = null;
    daterange: daterangepicker.Options | null = null;
}

export let appConfig = new AppConfig();

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

    Chart.register(...registerables);
    Chart.register(zoomPlugin);

    const chartCanvas = <HTMLCanvasElement>$("#speed-chart").get(0);
    const chartContext = chartCanvas.getContext("2d");
    let chartJS: Chart | null = null;

    if (chartContext != null) {
        chartJS = new Chart(chartContext, {
            type: "line",
            data: {
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
                ] as ChartDataset<"line">[]
            } as ChartData<"line">,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                hover: {
                    mode: "nearest",
                    intersect: true
                },
                scales: {
                    x: {
                        display: true,
                        type: "time",
                        time: {
                            unit: "day"
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: "bottom"
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: "x"
                            // pan options and/or events
                        },
                        limits: {
                            // axis limits
                        },
                        zoom: {
                            wheel: {
                                enabled: true
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: "x"
                            // zoom options and/or events
                        }
                    }
                }
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

    // Initialize the application
    $(function () {
        const parseManager = new ParseManager();

        parseManager.setChart(chartJS);

        const dateRange = new daterangepicker($("input[name='daterange']").get(0), daterangeConfig, function (
            start: moment.Moment,
            end: moment.Moment
        ) {
            parseManager.update(start, end);
        });

        moment.locale(appConfig.locale);

        if (appConfig.daterange != null && appConfig.daterange.startDate && appConfig.daterange.endDate) {
            parseManager.setStartDate(appConfig.daterange.startDate);
            parseManager.setEndDate(appConfig.daterange.endDate);
        }
        parseManager.parse();

        const buttonStartSpeedtest = $("#button-start-speedtest");
        buttonStartSpeedtest.on("click", function () {
            const buttonHelper = new ButtonHelper(buttonStartSpeedtest);

            buttonHelper.loading();

            $.get("/run_speedtest", function () {
                buttonHelper.reset();
                parseManager.flushChart(true, function () {
                    parseManager.parse();
                });
            });
        });
    });
});
