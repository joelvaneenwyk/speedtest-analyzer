/**
 * all the custom
 * @author github/roest01
 * @author github/joelvaneenwyk
 */

import "./scss/home.scss";

// You can specify which plugins you need
import $ from "jquery";
import moment from "moment";
import { Chart, ChartDataset, ChartData, registerables, ChartConfiguration, Color } from "chart.js";
import "chartjs-adapter-moment";
import ZoomPlugin from "chartjs-plugin-zoom";
import Papa from "papaparse";
import daterangepicker from "daterangepicker";

enum SpeedtestResultCategory {
    download,
    upload,
    ping
}

type SpeedtestResultOptions = {
    label: string;
    color?: Color;
    faded?: Color;
};

type SpeedtestResultsOptions = {
    [Property in keyof typeof SpeedtestResultCategory]: SpeedtestResultOptions;
};

class SpeedtestOptions {
    customTitle: string | undefined;
    dateFormat: string = "YYYY.MM.DD";
    locale: string = "en";
    resultOptions: SpeedtestResultsOptions = {
        download: {
            label: "Download",
            color: "rgba(255,190,142,0.7)",
            faded: "rgba(255,190,142,0.4)"
        },
        upload: {
            label: "Upload",
            color: "rgba(143,181,178,0.8)",
            faded: "rgba(143,181,178,0.4)"
        },
        ping: {
            label: "Ping",
            color: "rgba(90,90,90,0.9)",
            faded: "rgba(90,90,90,0.4)"
        }
    };
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

class SpeedtestResult {
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
        this.timestamp = parseInt(data[SpeedtestResult._indexTimestamp]);
        this.ping = parseFloat(data[SpeedtestResult._indexPing]);
        this.download = parseFloat(data[SpeedtestResult._indexDownload]);
        this.upload = parseFloat(data[SpeedtestResult._indexUpload]);

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

/**
 * Date type we use to store a speedtest result for chart display. This matches the internal data
 * used by ChartJS so that we can skip parsing step.
 */
type ParsedDataType = { x: number; y: number };

class SpeedtestDataView {
    private useChartDecimation = false;

    private _dataHeader: string[] = [];

    private _chartData: { [key: number]: SpeedtestResult } = {};
    private _chartDataMeasures: SpeedtestResult[] = [];

    private _chart: Chart;
    private _buttonStartSpeedtest: JQuery<HTMLElement>;

    private _uploadCount: number = 0;
    private _downloadCount: number = 0;

    private _dateRangePicker: daterangepicker;

    private _options: SpeedtestOptions;

    private _viewMin: SpeedtestResult | undefined;
    private _viewMax: SpeedtestResult | undefined;

    constructor(chartContext: CanvasRenderingContext2D, options: SpeedtestOptions) {
        const me = this;

        this._options = options;

        moment.locale(this._options.locale);

        const chartData: ChartData<"line"> = {
            labels: [],
            datasets: [
                {
                    indexAxis: "x",
                    label: this._options.resultOptions.ping.label,
                    fill: false,
                    backgroundColor: this._options.resultOptions.ping.color,
                    borderColor: this._options.resultOptions.ping.color,
                    tension: 0,
                    data: []
                },
                {
                    indexAxis: "x",
                    label: this._options.resultOptions.upload.label,
                    fill: false,
                    backgroundColor: this._options.resultOptions.upload.color,
                    borderColor: this._options.resultOptions.upload.color,
                    tension: 0,
                    data: []
                },
                {
                    indexAxis: "x",
                    label: this._options.resultOptions.download.label,
                    fill: true,
                    backgroundColor: this._options.resultOptions.download.color,
                    borderColor: this._options.resultOptions.download.color,
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
                animation: true,
                normalized: true,
                responsive: true,
                interaction: {
                    mode: "nearest",
                    intersect: true
                },
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: "time",
                        ticks: {
                            align: "center",
                            padding: 5,
                            maxRotation: 45,
                            minRotation: 45,
                            major: {
                                enabled: true
                            }
                        },
                        time: {
                            stepSize: 2,
                            displayFormats: {
                                minute: "MMM DD, hhA",
                                hour: "MMM DD, hhA",
                                day: "YYYY-MM-DD",
                                week: "YYYY-MM-DD",
                                month: "MMM YYYY",
                                year: "YYYY"
                            }
                        },
                        title: {
                            display: true,
                            text: "Test Time",
                            font: {
                                size: 13,
                                weight: "bold"
                            }
                        }
                    },
                    y: {
                        type: "linear",
                        axis: "y",
                        min: 0,
                        ticks: {
                            padding: 20,
                            callback: function (tickValue, index, values) {
                                return Number(tickValue).toFixed(1).toString();
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label(item: any) {
                                const label = chartData.datasets[item.datasetIndex].label;
                                const useMegabits = label != me._options.resultOptions.ping.label;
                                return useMegabits
                                    ? `${label}: ${item.formattedValue} MBits/s`
                                    : `${label}: ${item.formattedValue} ms`;
                            }
                        }
                    },
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
                        limits: {
                            y: {
                                min: 0
                            }
                        },
                        pan: {
                            mode: "xy",
                            enabled: true,
                            onPanStart: (context) => this._onViewChangeStart(),
                            onPanComplete: (context) => this._onViewChangeEnd()
                        },
                        zoom: {
                            mode: "x",
                            wheel: {
                                enabled: true
                            },
                            pinch: {
                                enabled: true
                            },
                            onZoomStart: (context) => this._onViewChangeStart(),
                            onZoomComplete: (context) => this._onViewChangeEnd()
                        }
                    }
                }
            }
        } as ChartConfiguration<"line">;

        let currentChart = Chart.getChart(chartContext);

        this._chart = currentChart != null ? currentChart : new Chart(chartContext, chartConfig);

        const dateRangeConfig: daterangepicker.Options = $.extend(
            {
                locale: {
                    format: this._options.dateFormat
                },
                autoApply: true,
                opens: "left"
            },
            this._options.dateRangePickerOptions
        );

        if (sessionStorage.getItem("startDate")) {
            dateRangeConfig.startDate = moment(sessionStorage.getItem("startDate")).toDate();
        }

        if (sessionStorage.getItem("endDate")) {
            dateRangeConfig.endDate = moment(sessionStorage.getItem("endDate")).toDate();
        }

        this._dateRangePicker = new daterangepicker($("input[name='daterange']").get(0), dateRangeConfig, (start, end) =>
            this.onDatePickerChange(start, end)
        );

        this._buttonStartSpeedtest = $("#button-start-speedtest");
        this._buttonStartSpeedtest.on("click", () => this.onButtonClick());

        $("#button-refresh").on("click", () => {
            let onCompletes: (() => void)[] = [];

            me._chart.options.animation = {
                onComplete: function (event: any) {
                    onCompletes.forEach((onCompleteFunc) => onCompleteFunc());
                    me._chart.update();
                }
            };

            chartData.datasets.forEach((dataset) => {
                if (dataset.label) {
                    let refreshed = false;
                    let result = me._getResultOption(dataset.label);

                    onCompletes.push(function () {
                        if (!refreshed) {
                            refreshed = true;
                            dataset.backgroundColor = result.color;
                            dataset.animation = {
                                easing: "easeOutSine",
                                duration: 300 + (Math.random() * 80 - 40)
                            };
                        }
                    });

                    dataset.animation = {
                        easing: "easeInBack",
                        duration: 200 + (Math.random() * 80 - 40)
                    };

                    dataset.backgroundColor = result.faded;

                    this._chart.update();
                }
            });
        });
    }

    _getResultOption(label: string): SpeedtestResultOptions {
        let result;

        if (label == this._options.resultOptions.download.label) {
            result = this._options.resultOptions.download;
        } else if (label == this._options.resultOptions.upload.label) {
            result = this._options.resultOptions.upload;
        } else {
            result = this._options.resultOptions.ping;
        }

        return result;
    }

    _onViewChangeStart() {
        let decimation = this._chart.config.options?.plugins?.decimation;
        decimation && (decimation.enabled = false);
    }

    _onViewChangeEnd() {
        let decimation = this._chart.config.options?.plugins?.decimation;
        decimation && (decimation.enabled = this.useChartDecimation);

        let start = moment(this._chart.scales.x.min);
        let end = moment(this._chart.scales.x.max);

        this._dateRangePicker.setStartDate(start.toDate());
        this._dateRangePicker.setEndDate(end.toDate());

        sessionStorage.setItem("startDate", start.toISOString());
        sessionStorage.setItem("endDate", end.toISOString());
    }

    onDatePickerChange(start: moment.Moment, end: moment.Moment) {
        this._chart.zoomScale("x", {
            min: this._dateRangePicker.startDate.valueOf(),
            max: this._dateRangePicker.endDate.valueOf()
        });
    }

    onButtonClick() {
        const me = this;
        me._setButtonLabelLoading();

        console.log("Issued speedtest request.");

        $.get("/run_speedtest", function (data, status) {
            me._resetButtonLabel();
            console.log(`Response: '${data}' '${status}'`);
            me.parseData();
        }).fail(function () {
            me._resetButtonLabel();
            console.log("Failed to run speedtest on server.");
            me.parseData();
        });
    }

    _setButtonLabelLoading() {
        this._buttonStartSpeedtest.html(this._buttonStartSpeedtest.data("loading-text"));
    }

    _resetButtonLabel() {
        this._buttonStartSpeedtest.html(this._buttonStartSpeedtest.data("original-text"));
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
                    let timestamp =
                        moment(time)
                            .add(Math.random() * 60 * 12, "m")
                            .unix() * 1000.0;
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
                if (me._dataHeader.length == 0) {
                    me._dataHeader = row.data;
                    SpeedtestResult.initialize(row.data);
                } else {
                    me.addDataRow(new SpeedtestResult(row.data));
                }
            },
            complete(results: Papa.ParseResult<string>) {
                me.addDataRows(me._chartData);
            }
        });
    }

    addDataRow(measureRow: SpeedtestResult) {
        if (measureRow.isValid()) {
            this._chartData[measureRow.timestamp] = measureRow;
        }
    }

    _findElementIndex(ar: any[], el: any, compare_fn: any) {
        var m: number = 0;
        var n: number = ar.length - 1;
        while (m <= n) {
            var k = (n + m) >> 1;
            var cmp = compare_fn(el, ar[k]);
            if (cmp > 0) {
                m = k + 1;
            } else if (cmp < 0) {
                n = k - 1;
            } else {
                return k;
            }
        }
        return -m - 1;
    }

    addDataRows(measureRows: { [key: number]: SpeedtestResult }) {
        const me = this;

        if (this._chart.data.labels != undefined && this._chart.data.datasets != undefined) {
            let measures = Object.values(measureRows).sort((a, b) => {
                return a.time.diff(b.time);
            });

            let dataLabels: string[] = this._chart.data.labels as string[];
            let dataPings: ParsedDataType[] = this._chart.data.datasets[0].data as ParsedDataType[];
            let dataUploads: ParsedDataType[] = this._chart.data.datasets[1].data as ParsedDataType[];
            let dataDownloads: ParsedDataType[] = this._chart.data.datasets[2].data as ParsedDataType[];
            let previousRow: SpeedtestResult | undefined;

            this._viewMin = undefined;
            this._viewMax = undefined;

            let insertIndex = 0;
            let measureIndex = 0;

            while (measureIndex < measures.length) {
                const measure = measures[measureIndex];

                while (
                    insertIndex < this._chartDataMeasures.length &&
                    this._chartDataMeasures[insertIndex].timestamp < measure.timestamp
                ) {
                    insertIndex++;
                }

                if (
                    insertIndex >= this._chartDataMeasures.length ||
                    this._chartDataMeasures[insertIndex].timestamp != measure.timestamp
                ) {
                    if (measure.upload > measure.download) {
                        me._uploadCount += 1;
                    } else {
                        me._downloadCount += 1;
                    }

                    const label = measure.time.format("YYYY-MM-DD");

                    if (me._viewMin == undefined && measure.time.isAfter(me._dateRangePicker.startDate)) {
                        me._viewMin = measure;
                    }

                    if (
                        me._viewMin != undefined &&
                        me._viewMax == undefined &&
                        measure.time.isAfter(me._dateRangePicker.endDate)
                    ) {
                        me._viewMax = measure;
                    }

                    // Insert a gap measure so that we do not get filled graph between disconnected days
                    if (previousRow != undefined && measure.time.diff(previousRow.time, "days") >= 1.5) {
                        dataPings.splice(insertIndex, 0, { x: previousRow.timestamp + 1, y: NaN });
                        dataUploads.splice(insertIndex, 0, { x: previousRow.timestamp + 1, y: NaN });
                        dataDownloads.splice(insertIndex, 0, { x: previousRow.timestamp + 1, y: NaN });
                        dataLabels.splice(insertIndex, 0, "");
                        insertIndex++;
                    }

                    dataPings.splice(insertIndex, 0, { x: measure.timestamp, y: measure.ping });
                    dataUploads.splice(insertIndex, 0, { x: measure.timestamp, y: measure.upload });
                    dataDownloads.splice(insertIndex, 0, { x: measure.timestamp, y: measure.download });
                    dataLabels.splice(insertIndex, 0, label);
                    this._chartDataMeasures.splice(insertIndex, 0, measure);

                    insertIndex++;

                    previousRow = measure;
                }

                measureIndex++;
            }

            const dataSets = this._chart.data.datasets as ChartDataset<"line">[];

            // Graph has to be filled dynamically whether upload or download is higher.
            const total = this._uploadCount + this._downloadCount;
            let largerValue = 0;

            if (this._uploadCount > this._downloadCount) {
                dataSets[1].fill = "+1"; // fill upload till download line
                dataSets[2].fill = "origin";
                largerValue = this._uploadCount;
            } else {
                // Upload lower than download -> priority for upload
                dataSets[1].fill = "origin";
                dataSets[2].fill = "-1"; // fill download starting @ upload line
                largerValue = this._downloadCount;
            }

            const percentDominated = (largerValue * 100) / total;

            if (percentDominated < 70) {
                // Threshold: No fill for upload because more than 30% overlapping
                dataSets[1].fill = false;
                dataSets[2].fill = true;
            }

            if (this._viewMax == undefined && previousRow != undefined) {
                this._viewMax = previousRow;
            }

            if (this._dateRangePicker.endDate && this._dateRangePicker.startDate) {
                this._chart.zoomScale("x", {
                    min: this._dateRangePicker.startDate.valueOf(),
                    max: this._dateRangePicker.endDate.valueOf()
                });
            }

            this._chart.update();
        }
    }
}

function createSpeedtestView() {
    let options = new SpeedtestOptions();

    $(function () {
        Chart.register(...registerables);
        Chart.register(ZoomPlugin);

        const chartCanvas = <HTMLCanvasElement>$("#speed-chart").get(0);
        const chartContext = chartCanvas.getContext("2d");
        if (chartContext != null) {
            const parseManager = new SpeedtestDataView(chartContext, options);
            parseManager.parseData();
        }
    });

    return options;
}

export let speedtestConfig = createSpeedtestView();

export default speedtestConfig;
