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

type SpeedtestResultLabels = {
    [Property in keyof typeof SpeedtestResultCategory]: string;
};

type SpeedtestResultColors = {
    [Property in keyof typeof SpeedtestResultCategory]: Color;
};

class SpeedtestOptions {
    customTitle: string | undefined;
    dateFormat: string = "YYYY.MM.DD";
    locale: string = "en";
    labels: SpeedtestResultLabels = {
        download: "Download",
        upload: "Upload",
        ping: "Ping"
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

    // Failed pings are recorded as huge timeouts (e.g. 1800000) which would flatten the whole graph
    static readonly maxPing = 60 * 1000;

    isValid(): boolean {
        return this.time.isValid() && this.timestamp >= 0 && (this.ping > 0 || this.download > 0 || this.upload > 0);
    }

    constructor(data: string[]) {
        this.timestamp = parseInt(data[MeasureRow._indexTimestamp]);
        this.ping = parseFloat(data[MeasureRow._indexPing]);
        this.download = parseFloat(data[MeasureRow._indexDownload]);
        this.upload = parseFloat(data[MeasureRow._indexUpload]);

        if (this.ping >= MeasureRow.maxPing) {
            this.ping = NaN;
        }

        // Convert from unix milliseconds to date
        this.time = moment(this.timestamp);
    }

    static initialize(header: string[]) {
        for (let i = 0; i < header.length; i += 1) {
            const dataName = header[i].trim();
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

/**
 * Index of the first measure with a timestamp at or after the given time.
 */
function lowerBound(measures: MeasureRow[], timestamp: number): number {
    let low = 0;
    let high = measures.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (measures[mid].timestamp < timestamp) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    return low;
}

class SpeedtestDataView {
    /**
     * Candidate bucket sizes (in minutes) used when there are more measurements than pixels. Using
     * fixed sizes keeps bucket boundaries stable while panning so the graph does not shimmer.
     */
    private static readonly bucketSizes = [1, 5, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080, 20160, 43200].map(
        (minutes) => minutes * 60 * 1000
    );

    private static readonly pixelsPerPoint = 2;

    private axisColors: SpeedtestResultColors = {
        download: "rgba(255,190,142,0.7)",
        ping: "rgba(90,90,90,0.9)",
        upload: "rgba(143,181,178,0.8)"
    };

    private axisColorsFaded: SpeedtestResultColors = {
        download: "rgba(255,190,142,0.4)",
        ping: "rgba(90,90,90,0.4)",
        upload: "rgba(143,181,178,0.4)"
    };

    private _dataHeader: string[] = [];

    private _chartData: { [key: number]: MeasureRow } = {};

    // All measures sorted by time; the chart datasets only hold what is needed for the current view
    private _chartDataMeasures: MeasureRow[] = [];

    // Number of measures averaged into each point of the current view
    private _pointCounts: number[] = [];

    private _chart: Chart;
    private _buttonStartSpeedtest: JQuery<HTMLElement>;

    private _dateRangePicker: daterangepicker;

    private _options: SpeedtestOptions;

    constructor(chartContext: CanvasRenderingContext2D, options: SpeedtestOptions) {
        const me = this;

        this._options = options;

        moment.locale(this._options.locale);

        const chartData: ChartData<"line"> = {
            labels: [],
            datasets: [
                {
                    indexAxis: "x",
                    label: this._options.labels.ping,
                    fill: false,
                    backgroundColor: me.axisColors.ping,
                    borderColor: me.axisColors.ping,
                    stepped: true,
                    data: []
                },
                {
                    indexAxis: "x",
                    label: this._options.labels.upload,
                    fill: false,
                    backgroundColor: me.axisColors.upload,
                    borderColor: me.axisColors.upload,
                    stepped: true,
                    data: []
                },
                {
                    indexAxis: "x",
                    label: this._options.labels.download,
                    fill: true,
                    backgroundColor: me.axisColors.download,
                    borderColor: me.axisColors.download,
                    stepped: true,
                    data: []
                }
            ] as ChartDataset<"line">[]
        } as ChartData<"line">;

        const chartConfig: ChartConfiguration<"line"> = {
            type: "line",
            data: chartData,
            options: {
                // Each measurement holds until the next one so missing data does not leave holes
                spanGaps: true,
                parsing: false,
                animation: false,
                normalized: true,
                responsive: true,
                maintainAspectRatio: false,
                elements: {
                    point: {
                        radius: 0,
                        hoverRadius: 4,
                        hitRadius: 4
                    }
                },
                interaction: {
                    mode: "index",
                    intersect: false
                },
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
                            onZoomComplete: (context) => this._onViewChangeEnd()
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label(item) {
                                const label = item.dataset.label;
                                const value = item.parsed.y.toFixed(1);
                                const useMegabits = label != me._options.labels.ping;
                                return useMegabits ? `${label}: ${value} MBits/s` : `${label}: ${value} ms`;
                            },
                            footer(items) {
                                const count = items.length > 0 ? me._pointCounts[items[0].dataIndex] : 0;
                                return count > 1 ? `Average of ${count} tests` : "";
                            }
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
                    let original: Color;
                    let faded: Color;
                    let refreshed = false;

                    if (dataset.label == me._options.labels.download) {
                        original = me.axisColors.download;
                        faded = me.axisColorsFaded.download;
                    } else if (dataset.label == me._options.labels.upload) {
                        original = me.axisColors.upload;
                        faded = me.axisColorsFaded.upload;
                    } else {
                        original = me.axisColors.ping;
                        faded = me.axisColorsFaded.ping;
                    }

                    onCompletes.push(function () {
                        if (!refreshed) {
                            refreshed = true;
                            dataset.backgroundColor = original;
                            dataset.animation = {
                                easing: "easeOutSine",
                                duration: 300
                            };
                        }
                    });

                    dataset.animation = {
                        easing: "easeInBack",
                        duration: 200
                    };

                    dataset.backgroundColor = faded;

                    this._chart.update();
                }
            });
        });
    }

    _onViewChangeEnd() {
        let start = moment(this._chart.scales.x.min);
        let end = moment(this._chart.scales.x.max);

        this._dateRangePicker.setStartDate(start.toDate());
        this._dateRangePicker.setEndDate(end.toDate());

        sessionStorage.setItem("startDate", start.toISOString());
        sessionStorage.setItem("endDate", end.toISOString());

        this._updateViewData(start.valueOf(), end.valueOf());
        this._chart.update("none");
    }

    onDatePickerChange(start: moment.Moment, end: moment.Moment) {
        this._zoomToDateRange();
    }

    _zoomToDateRange() {
        const min = this._dateRangePicker.startDate.valueOf();
        const max = this._dateRangePicker.endDate.valueOf();
        this._updateViewData(min, max);
        this._chart.zoomScale("x", { min, max });
    }

    /**
     * Fill the datasets with points for the given range plus one range on either side so that
     * panning has data to show. When there are more measurements than pixels they are averaged into
     * fixed time buckets, which keeps rendering cost bounded no matter how much history there is.
     */
    _updateViewData(min: number, max: number) {
        const datasets = this._chart.data.datasets as ChartDataset<"line", ParsedDataType[]>[];
        const measures = this._chartDataMeasures;
        const range = Math.max(max - min, 1);
        const width = this._chart.chartArea?.width || this._chart.width;
        const targetPoints = Math.max(width / SpeedtestDataView.pixelsPerPoint, 1);

        // Include the measure before and after the span so the steps at the edges have a value
        const start = Math.max(lowerBound(measures, min - range) - 1, 0);
        const end = Math.min(lowerBound(measures, max + range) + 1, measures.length);
        const visibleCount = lowerBound(measures, max) - lowerBound(measures, min);

        const pings: ParsedDataType[] = [];
        const uploads: ParsedDataType[] = [];
        const downloads: ParsedDataType[] = [];
        const counts: number[] = [];

        if (visibleCount <= targetPoints) {
            for (let i = start; i < end; i++) {
                const measure = measures[i];
                pings.push({ x: measure.timestamp, y: measure.ping });
                uploads.push({ x: measure.timestamp, y: measure.upload });
                downloads.push({ x: measure.timestamp, y: measure.download });
                counts.push(1);
            }
        } else {
            const idealSize = range / targetPoints;
            const bucketSize = SpeedtestDataView.bucketSizes.filter((size) => size >= idealSize)[0] || idealSize;

            // Sum and count per value since a measure can be missing individual values
            let sums = [0, 0, 0];
            let sumCounts = [0, 0, 0];
            let bucket = NaN;
            let count = 0;

            const flush = () => {
                if (count > 0) {
                    pings.push({ x: bucket, y: sums[0] / sumCounts[0] });
                    uploads.push({ x: bucket, y: sums[1] / sumCounts[1] });
                    downloads.push({ x: bucket, y: sums[2] / sumCounts[2] });
                    counts.push(count);
                }
                sums = [0, 0, 0];
                sumCounts = [0, 0, 0];
                count = 0;
            };

            for (let i = start; i < end; i++) {
                const measure = measures[i];
                const measureBucket = Math.floor(measure.timestamp / bucketSize) * bucketSize;
                if (measureBucket != bucket) {
                    flush();
                    bucket = measureBucket;
                }

                const values = [measure.ping, measure.upload, measure.download];
                for (let v = 0; v < values.length; v++) {
                    if (isFinite(values[v])) {
                        sums[v] += values[v];
                        sumCounts[v] += 1;
                    }
                }
                count++;
            }
            flush();
        }

        // Only show individual points when they are far enough apart to be distinguishable
        const pointRadius = visibleCount <= targetPoints / 4 ? 2 : 0;

        [pings, uploads, downloads].forEach((data, index) => {
            datasets[index].data = data;
            datasets[index].pointRadius = pointRadius;
        });
        this._pointCounts = counts;
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

            // Files can mix CRLF and LF (e.g. git autocrlf on older rows); splitting on LF handles
            // both since the numeric parsing ignores a trailing CR.
            newline: "\n",
            skipEmptyLines: true,

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
                    MeasureRow.initialize(row.data);
                } else {
                    me.addDataRow(new MeasureRow(row.data));
                }
            },
            complete(results: Papa.ParseResult<string>) {
                me.addDataRows(me._chartData);
            }
        });
    }

    addDataRow(measureRow: MeasureRow) {
        if (measureRow.isValid()) {
            this._chartData[measureRow.timestamp] = measureRow;
        }
    }

    addDataRows(measureRows: { [key: number]: MeasureRow }) {
        const measures = Object.values(measureRows).sort((a, b) => a.timestamp - b.timestamp);
        this._chartDataMeasures = measures;

        let uploadCount = 0;
        let downloadCount = 0;
        for (const measure of measures) {
            if (measure.upload > measure.download) {
                uploadCount += 1;
            } else {
                downloadCount += 1;
            }
        }

        const dataSets = this._chart.data.datasets as ChartDataset<"line">[];

        /**
         * Graph has to be filled dynamically whether upload or download is higher.
         */
        const total = uploadCount + downloadCount;
        let largerValue = 0;

        if (uploadCount > downloadCount) {
            dataSets[1].fill = "+1"; // fill upload till download line
            dataSets[2].fill = "origin";
            largerValue = uploadCount;
        } else {
            // upload lower than download -> priority for upload
            dataSets[1].fill = "origin";
            dataSets[2].fill = "-1"; // fill download starting @ upload line
            largerValue = downloadCount;
        }

        const percentDominated = (largerValue * 100) / total;

        if (percentDominated < 70) {
            //Threshold: No fill for upload because more than 30% overlapping
            dataSets[1].fill = false;
            dataSets[2].fill = true;
        }

        if (this._dateRangePicker.endDate && this._dateRangePicker.startDate) {
            this._zoomToDateRange();
        } else if (measures.length > 0) {
            this._updateViewData(measures[0].timestamp, measures[measures.length - 1].timestamp);
            this._chart.update("none");
        }
    }
}

export let speedtestConfig = new SpeedtestOptions();

$(function () {
    Chart.register(...registerables);
    Chart.register(ZoomPlugin);

    const chartCanvas = <HTMLCanvasElement>$("#speed-chart").get(0);
    const chartContext = chartCanvas.getContext("2d");
    if (chartContext != null) {
        const parseManager = new SpeedtestDataView(chartContext, speedtestConfig);
        parseManager.parseData();
    }
});
