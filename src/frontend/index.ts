/**
 * all the custom
 * @author github/roest01
 * @author github/joelvaneenwyk
 */

import "./scss/home.scss";

// You can specify which plugins you need
import $ from "jquery";
import moment from "moment";
import {
    Chart,
    ChartDataset,
    ChartData,
    registerables,
    ChartConfiguration,
    ChartComponentLike,
    ScatterDataPoint
} from "chart.js";
import "chartjs-adapter-moment";
import zoomPlugin from "chartjs-plugin-zoom";
import Papa from "papaparse";
import daterangepicker from "daterangepicker";

class ButtonStartSpeedtest {
    button: JQuery<HTMLElement>;

    constructor(buttonId: string) {
        this.button = $(buttonId);
    }

    onClick(callback: { (): void }) {
        const _button = this;

        this.button.on("click", () => {
            _button.loading();
            callback();
        });
    }

    done() {
        this.reset();
    }

    loading() {
        this.button.html($.data(this.button, "loading-text"));
    }

    reset() {
        this.button.html($.data(this.button, "original-text"));
    }
}

class MeasureRow {
    timestamp: number = 0;
    ping: number = 0;
    download: number = 0;
    upload: number = 0;
    time: moment.Moment = moment();

    static _indexTimestamp: number;
    static _indexPing: number;
    static _indexDownload: number;
    static _indexUpload: number;

    isValid(): boolean {
        return this.time.isValid() && this.timestamp >= 0 && (this.ping > 0 || this.download > 0 || this.upload > 0);
    }

    constructor(data: string[]) {
        this.timestamp = parseInt(data[MeasureRow._indexTimestamp]);
        this.ping = parseFloat(data[MeasureRow._indexPing]);
        this.download = parseFloat(data[MeasureRow._indexDownload]);
        this.upload = parseFloat(data[MeasureRow._indexUpload]);

        // Convert from unix milliseconds to date
        this.time = moment(this.timestamp / 1000.0, "X");
    }

    static initialize(header: string[]) {
        for (let i = 0; i < header.length; i += 1) {
            const dataName = header[i];
            if (dataName == "timestamp") {
                this._indexTimestamp = i;
            } else if (dataName == "ping") {
                this._indexPing = i;
            } else if (dataName == "download") {
                this._indexDownload = i;
            } else if (dataName == "upload") {
                this._indexUpload = i;
            }
        }
    }
}

type ParsedDataType = { x: number; y: number };

class ParseManager {
    header: string[] = [];
    data: { [key: string]: MeasureRow } = {};
    _startDate: moment.Moment | undefined = undefined;
    _endDate: moment.Moment | undefined = undefined;
    _chart: Chart;
    uploadCount: number = 0;
    downloadCount: number = 0;

    constructor(chart: Chart) {
        this._chart = chart;
    }

    /**
     * parse result.csv and create graph with _startDate and _endDate filter
     */
    parse(input: string = "data/result.csv", download: boolean = true) {
        const me = this;

        Papa.parse(input, {
            download: download,

            error(error: Papa.ParseError) {
                console.log("Failed to load data.");

                // timestamp,ping,download,upload
                // 1622003836030.828,20.31,87.7,2.29
                // 1622004027043.011,21.01,86.2,2.72
                // 1622004114406.986,22.48,85.9,2.29
                // 1622005257000.246,24.42,78.7,1.90

                //let today: moment.Moment = moment();
                //let time = moment().subtract(20, "d");
                //let csvData: string = "timestamp,ping,download,upload\n";
                //while (time.isBefore(today)) {
                //    let timestamp = moment(time)
                //        .add(Math.random() * 60 * 12, "m")
                //        .unix();
                //    let ping = Math.random() * 50 + 10;
                //    let download = Math.random() * 500 + 10;
                //    let upload = Math.random() * 30 + 10;
                //    csvData += `${timestamp.toString()},${ping},${download},${upload}\n`;
                //    time = time.add(1, "d");
                //}
                //console.log(csvData);
                //parseManager.parse(csvData, false);
            },
            step(row: Papa.ParseResult<string>) {
                if (me.header.length == 0) {
                    me.header = row.data;
                    MeasureRow.initialize(row.data);
                } else {
                    me.addDataRow(new MeasureRow(row.data));
                }
            },
            complete(results: Papa.ParseResult<string>) {
                me.flush();
            }
        });
    }

    flush() {
        this.addDataRows(this.data);
        this.data = {};
        this._chart.update();
    }

    addDataRow(measureRow: MeasureRow) {
        if (measureRow.isValid()) {
            this.data[measureRow.timestamp] = measureRow;
        }
    }

    _makeDataPoint(x: number, y: number): ParsedDataType {
        return {
            x: x,
            y: y
        };
    }

    addDataRows(measureRows: { [key: string]: MeasureRow }) {
        let timeSorted: string[] = [];
        for (let key in measureRows) {
            timeSorted.push(key);
        }
        timeSorted.sort();

        if (this._chart.data.labels != undefined && this._chart.data.datasets != undefined) {
            const me = this;
            let dataLabels: string[] = [];
            let dataPings: ParsedDataType[] = [];
            let dataUploads: ParsedDataType[] = [];
            let dataDownloads: ParsedDataType[] = [];

            timeSorted.forEach(function (timestamp: string) {
                let measureRow = measureRows[timestamp];

                if (measureRow.upload > measureRow.download) {
                    me.uploadCount += 1;
                } else {
                    me.downloadCount += 1;
                }

                const label = measureRow.time.format("YYYY-MM-DD");
                dataPings.push(me._makeDataPoint(measureRow.timestamp, measureRow.ping));
                dataUploads.push(me._makeDataPoint(measureRow.timestamp, measureRow.upload));
                dataDownloads.push(me._makeDataPoint(measureRow.timestamp, measureRow.download));
                dataLabels.push(label);
            });

            this._chart.data.labels = dataLabels;
            this._chart.data.datasets[0].data = dataPings;
            this._chart.data.datasets[1].data = dataUploads;
            this._chart.data.datasets[2].data = dataDownloads;

            const dataSets = this._chart.data.datasets as ChartDataset<"line">[];

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
    customTitle: string;
    dateFormat: string = "YYYY.MM.DD";
    locale: string = "en";
    labels: AppConfigLabels = new AppConfigLabels();
    _chart: Chart | null = null;
    daterange: daterangepicker.Options;

    constructor() {
        this.customTitle = "Speedtest Statistics v1.4.3";
        this.daterange = {
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

        $(function () {
            $.getScript("data/config.js")
                .done(function (script: any, textStatus: any) {
                    console.log(`Loaded custom configuration. Status: '${textStatus}'`);
                })
                .fail(function () {
                    console.log("No custom configuration available."); // 200
                });
        });
    }
}

export let appConfig = new AppConfig();

$(function () {
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
    if (chartContext != null) {
        let data = {
            labels: [],
            datasets: [
                {
                    indexAxis: "x",
                    label: appConfig.labels.ping,
                    fill: false,
                    backgroundColor: colors.black,
                    borderColor: colors.black,
                    tension: 0,
                    data: []
                },
                {
                    indexAxis: "x",
                    label: appConfig.labels.upload,
                    fill: false,
                    backgroundColor: colors.green,
                    borderColor: colors.green,
                    tension: 0,
                    data: []
                },
                {
                    indexAxis: "x",
                    label: appConfig.labels.download,
                    fill: true,
                    backgroundColor: colors.orange,
                    borderColor: colors.orange,
                    tension: 0,
                    data: []
                }
            ] as ChartDataset<"line">[]
        } as ChartData<"line">;

        let config = {
            type: "line",
            data: data,
            options: {
                parsing: false,
                animation: false,
                normalized: true,
                responsive: true,
                maintainAspectRatio: false,
                hover: {
                    mode: "nearest",
                    intersect: true
                },
                scales: {
                    x: {
                        type: "time",
                        time: {
                            displayFormats: {
                                day: "YYYY-MM-DD",
                                month: "MMM YYYY",
                                year: "YYYY"
                            }
                        },
                        title: {
                            display: true,
                            text: "Speedtest Time"
                        }
                    }
                },
                plugins: {
                    decimation: {
                        enabled: true,
                        threshold: 400,
                        algorithm: "lttb",
                        samples: 1000
                    },
                    legend: {
                        position: "bottom"
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: "xy"
                        },
                        zoom: {
                            wheel: {
                                enabled: true
                            },
                            pinch: {
                                enabled: true
                            },
                            mode: "x"
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
        } as ChartConfiguration<"line">;

        let chartJS = new Chart(chartContext, config);
        const parseManager = new ParseManager(chartJS);

        const daterangeConfig: daterangepicker.Options = {
            locale: {
                format: appConfig.dateFormat
            },
            autoApply: true,
            opens: "left"
        };
        $.extend(daterangeConfig, appConfig.daterange);

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

        const buttonStartSpeedtest = new ButtonStartSpeedtest("#button-start-speedtest");

        buttonStartSpeedtest.onClick(() => {
            console.log("Issued speedtest request.");
            $.get("/run_speedtest", function (data, status) {
                buttonStartSpeedtest.done();

                console.log(`Response: '${data}' '${status}'`);

                parseManager.flushChart(true, function () {
                    parseManager.parse();
                });
            });
        });
    }
});
