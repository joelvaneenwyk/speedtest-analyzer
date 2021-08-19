/**
 * all the custom
 * @author github/roest01
 * @author github/joelvaneenwyk
 */

import "./scss/home.scss";

// You can specify which plugins you need
import $ from "jquery";
import moment from "moment";
import { Chart, ChartDataset, ChartData, registerables, ChartConfiguration } from "chart.js";
import { valueOrDefault } from "chart.js/helpers";
import "chartjs-adapter-moment";
import zoomPlugin from "chartjs-plugin-zoom";
import Papa from "papaparse";
import daterangepicker from "daterangepicker";

class SpeedtestLabels {
    download: string = "Download";
    ping: string = "Ping";
    upload: string = "Upload";
}

class SpeedtestOptions {
    customTitle: string | undefined;
    dateFormat: string = "YYYY.MM.DD";
    locale: string = "en";
    labels: SpeedtestLabels = new SpeedtestLabels();
    dateRangePickerOptions: daterangepicker.Options;

    constructor() {
        this.dateRangePickerOptions = {
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

        let me = this;

        $(function () {
            $.getScript("data/config.js")
                .done(function (script: any, textStatus: any) {
                    console.log(`Loaded custom configuration. Status: '${textStatus}'`);
                    me.refresh();
                })
                .fail(function () {
                    console.log("No custom configuration available.");
                    me.refresh();
                });
        });
    }

    refresh() {
        if (this.customTitle) {
            $("#title").html(this.customTitle);
        }
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

class SpeedtestDataView {
    useChartDecimation = false;

    static axisColors = {
        orange: "rgba(255,190,142,0.5)",
        black: "rgba(90,90,90,1)",
        green: "rgba(143,181,178,0.8)"
    };

    header: string[] = [];
    data: { [key: string]: MeasureRow } = {};
    _startDate: moment.Moment | undefined = undefined;
    _endDate: moment.Moment | undefined = undefined;
    _chart: Chart;
    _uploadCount: number = 0;
    _downloadCount: number = 0;
    _dateRangePicker: daterangepicker;
    _buttonStartSpeedtest: JQuery<HTMLElement>;
    _options: SpeedtestOptions;

    constructor(chartContext: CanvasRenderingContext2D, options: SpeedtestOptions) {
        const me = this;

        this._buttonStartSpeedtest = $("#button-start-speedtest");
        this._options = options;

        moment.locale(this._options.locale);

        const chartData: ChartData<"line"> = {
            labels: [],
            datasets: [
                {
                    indexAxis: "x",
                    label: this._options.labels.ping,
                    fill: false,
                    backgroundColor: SpeedtestDataView.axisColors.black,
                    borderColor: SpeedtestDataView.axisColors.black,
                    tension: 0,
                    data: []
                },
                {
                    indexAxis: "x",
                    label: this._options.labels.upload,
                    fill: false,
                    backgroundColor: SpeedtestDataView.axisColors.green,
                    borderColor: SpeedtestDataView.axisColors.green,
                    tension: 0,
                    data: []
                },
                {
                    indexAxis: "x",
                    label: this._options.labels.download,
                    fill: true,
                    backgroundColor: SpeedtestDataView.axisColors.orange,
                    borderColor: SpeedtestDataView.axisColors.orange,
                    tension: 0,
                    data: []
                }
            ] as ChartDataset<"line">[]
        } as ChartData<"line">;

        const chartConfig: ChartConfiguration<"line"> = {
            type: "line",
            data: chartData,
            options: {
                spanGaps: false,
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
                        enabled: this.useChartDecimation,
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
                            mode: "xy",
                            onPan: (context) => this.onPan(context),
                            onPanComplete: (context) => this.onPanComplete(context)
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
                },
                tooltip: {
                    mode: "index",
                    intersect: false,
                    callbacks: {
                        label(item: any) {
                            const label = chartData.datasets[item.datasetIndex].label;
                            const useMegabits = label?.toLowerCase() != "ping";
                            return useMegabits
                                ? `${chartData.datasets[item.datasetIndex].label}: ${item.yLabel} MBits/s`
                                : `${chartData.datasets[item.datasetIndex].label}: ${item.yLabel}`;
                        }
                    }
                }
            }
        } as ChartConfiguration<"line">;

        let currentChart = Chart.getChart(chartContext);

        this._chart = currentChart != null ? currentChart : new Chart(chartContext, chartConfig);

        const daterangeConfig: daterangepicker.Options = {
            locale: {
                format: this._options.dateFormat
            },
            autoApply: true,
            opens: "left"
        };
        $.extend(daterangeConfig, this._options.dateRangePickerOptions);

        this._dateRangePicker = new daterangepicker($("input[name='daterange']").get(0), daterangeConfig, function (
            start: moment.Moment,
            end: moment.Moment
        ) {
            me.update(start, end);
        });

        if (
            this._options.dateRangePickerOptions != null &&
            this._options.dateRangePickerOptions.startDate &&
            this._options.dateRangePickerOptions.endDate
        ) {
            this.setStartDate(this._options.dateRangePickerOptions.startDate);
            this.setEndDate(this._options.dateRangePickerOptions.endDate);
        }

        this._buttonStartSpeedtest.on("click", () => this.onButtonClick());
    }

    onButtonClick() {
        const me = this;
        me._setButtonLabelLoading();

        console.log("Issued speedtest request.");

        $.get("/run_speedtest", function (data, status) {
            me._resetButtonLabel();

            console.log(`Response: '${data}' '${status}'`);

            me.flushChart(true, function () {
                me.parseData();
            });
        });
    }

    onPan(context: { chart: Chart }) {
        let decimation = context.chart.config.options?.plugins?.decimation;
        decimation && (decimation.enabled = false);
    }

    onPanComplete(context: { chart: Chart }) {
        let decimation = context.chart.config.options?.plugins?.decimation;
        decimation && (decimation.enabled = this.useChartDecimation);
        context.chart.update();
    }

    _setButtonLabelLoading() {
        this._buttonStartSpeedtest.html($.data(this._buttonStartSpeedtest, "loading-text"));
    }

    _resetButtonLabel() {
        this._buttonStartSpeedtest.html($.data(this._buttonStartSpeedtest, "original-text"));
    }

    /**
     * parse result.csv and create graph with _startDate and _endDate filter
     */
    parseData(input: string = "data/result.csv", download: boolean = true) {
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

                console.log("ERROR: Failed to load data. Created random data instead.");
                me.parseData(csvData, false);
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
            let previousRow: MeasureRow | undefined;

            let minIndex: number | undefined;
            let maxIndex: number | undefined;

            timeSorted.forEach(function (timestamp: string) {
                let measureRow = measureRows[timestamp];

                if (measureRow.upload > measureRow.download) {
                    me._uploadCount += 1;
                } else {
                    me._downloadCount += 1;
                }

                const label = measureRow.time.format("YYYY-MM-DD");

                if (previousRow != undefined && measureRow.time.isAfter(previousRow.time.add("7", "days"))) {
                    dataPings.push(me._makeDataPoint(previousRow.timestamp + 1, NaN));
                    dataUploads.push(me._makeDataPoint(previousRow.timestamp + 1, NaN));
                    dataDownloads.push(me._makeDataPoint(previousRow.timestamp + 1, NaN));
                    dataLabels.push("");
                }

                if (minIndex == undefined && measureRow.time.isAfter(me._startDate)) {
                    minIndex = measureRow.timestamp;
                }

                if (minIndex != undefined && maxIndex == undefined && measureRow.time.isAfter(me._endDate)) {
                    maxIndex = measureRow.timestamp;
                }

                dataPings.push(me._makeDataPoint(measureRow.timestamp, measureRow.ping));
                dataUploads.push(me._makeDataPoint(measureRow.timestamp, measureRow.upload));
                dataDownloads.push(me._makeDataPoint(measureRow.timestamp, measureRow.download));
                dataLabels.push(label);

                previousRow = measureRow;
            });

            this._chart.data.labels = dataLabels;
            this._chart.data.datasets[0].data = dataPings;
            this._chart.data.datasets[1].data = dataUploads;
            this._chart.data.datasets[2].data = dataDownloads;

            const dataSets = this._chart.data.datasets as ChartDataset<"line">[];

            /**
             * Graph has to be filled dynamically whether upload or download is higher.
             */
            const total = this._uploadCount + this._downloadCount;
            let largerValue = 0;

            if (this._uploadCount > this._downloadCount) {
                dataSets[1].fill = "+1"; // fill upload till download line
                dataSets[2].fill = "origin";
                largerValue = this._uploadCount;
            } else {
                // upload lower than download -> priority for upload
                dataSets[1].fill = "origin";
                dataSets[2].fill = "-1"; // fill download starting @ upload line
                largerValue = this._downloadCount;
            }

            const percentDominated = (largerValue * 100) / total;

            if (percentDominated < 70) {
                //Threshold: No fill for upload because more than 30% overlapping
                dataSets[1].fill = false;
                dataSets[2].fill = true;
            }

            if (maxIndex == undefined && previousRow != undefined) {
                maxIndex = previousRow.timestamp;
            }

            let xAxis = this._chart.scales["x"];

            if (minIndex != undefined && maxIndex != undefined) {
                //this._chart.options.datasets[0].su.min = minIndex;
                //xAxis.max = maxIndex;
            }

            xAxis.afterDataLimits = function () {
                if (minIndex != undefined && maxIndex != undefined) {
                    //xAxis.min = minIndex;
                    //xAxis.max = maxIndex;
                }
                xAxis.afterDataLimits = () => {};
            };

            this._chart.update();
        }
    }

    flushChart(force: boolean, callback: any) {
        this._uploadCount = 0;
        this._downloadCount = 0;

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
    setStartDate(startDate: moment.MomentInput): SpeedtestDataView {
        this._startDate = moment(startDate);
        return this;
    }

    /**
     * set end date as filter
     *
     * @param endDate
     * @returns {ParseManager}
     */
    setEndDate(endDate: moment.MomentInput): SpeedtestDataView {
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
        this.flushChart(true, () => this.parseData());
    }
}

export let speedtestOptions = new SpeedtestOptions();

$(function () {
    Chart.register(...registerables);
    Chart.register(zoomPlugin);

    const chartCanvas = <HTMLCanvasElement>$("#speed-chart").get(0);
    const chartContext = chartCanvas.getContext("2d");
    if (chartContext != null) {
        const parseManager = new SpeedtestDataView(chartContext, speedtestOptions);
        parseManager.parseData();
    }
});
