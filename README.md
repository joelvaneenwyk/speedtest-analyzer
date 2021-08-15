# Docker Speedtest Analyser

Automated docker speedtest analyser tool with included web interface to monitor your internet speed connection over time. Setup at home on your NAS (Synology, QNAP tested) and the container runs hourly speedtests. The speedtest results are displayed in an web interface as line graph(s) over the day.

This tool was created in reference to [this reddit post](https://www.reddit.com/r/technology/comments/43fi39/i_set_up_my_raspberry_pi_to_automatically_tweet/).
It used [speedtest-cli](https://github.com/sivel/speedtest-cli) to make speedtests and log them into a CSV file.
After that you can visit the web interface to view a hourly - time filterable reports about your internet connectivity speed.

![Statistic Screenshot](images/speedtest_screenshot.png)

## Docker Hub Image

You can get the publicly available docker image at the following location: [joelvaneenwyk/docker-speedtest-analyser](https://hub.docker.com/r/joelvaneenwyk/docker-speedtest-analyser/).

## Facts

1. The speedtest runs hourly by default
2. nginx is prepared but not configured for SSL yet
3. Data is saved in a _.csv_ under `/var/www/html/data/result.csv`
4. First speedtest will be executed in container build

## Installation

The SpeedTest analyser should to run out of the box with docker.

**Important:** To keep the history of speedtest within a rebuild of
the container please mount a volume in ``/var/www/html/data/``

### Setup

1. Mount host volume onto `/var/www/html/data/`
2. Map preferred host port on port _80_
3. Build container from image
4. Enjoy continuous speed statistics after a while

## Environment Variables

| Variable  | Type | Usage |  Example Value | Default |
| ------------- | ------------- | ------------- | ------------- | ------------- |
| CRONJOB_ITERATION  | INT  | Time between speedtests in minutes. Value 15 means the cronjob runs every 15 minutes. Keep undefined to run hourly. | 15 | 60 |
| SPEEDTEST_PARAMS  | STRING  | Append extra parameter for cli command (i.e., `speedtest-cli --simple $SPEEDTEST_PARAMS`). See [parameter documentation](https://github.com/sivel/speedtest-cli#usage) for available options.  | `--mini https://speedtest.test.fr` | none |

## Configuration

You can configure the visualization frontend using JavaScript.

1. Copy `/js/config.template.js` into `/data/config.js` where your volume should be mounted. Note that this is done automatically if you run the Docker first.
2. Update the values in `/data/config.js` and restart your Docker instance.

### Dependencies

1. Bootstrap 4
2. Chart.js
3. daterangepicker.js
4. moment.js
5. papaparse
6. speedtest-cli

## License

I kindly ask not to re-distribute this repo on hub.docker.com if it's not indispensable.

## Disclaimer / Off topic

This small tool was originally written for private use on Synology NAS. The original twitter function is removed in this version.

If you want to contribute and report / fix bugs or bring the feature stuff written for your
own setup, don't be shy.

Have fun and test your speed! 😊
