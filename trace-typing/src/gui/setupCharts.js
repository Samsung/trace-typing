/* 
 * Copyright 2015 Samsung Research America, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
google.load('visualization', '1.1', {
    'packages': ['bar']
});
function setupCharts(charts, columns, groupSizes) {
    google.setOnLoadCallback(drawCharts);
    function drawCharts() {
        function makeUniformMaxValueRow(rows) {
            var uniformMax = -Infinity;
            for (var rowIndex = 1; rowIndex < rows.length; rowIndex++) {
                var row = rows[rowIndex];
                uniformMax = Math.max(uniformMax, Math.max.apply(undefined, row.slice(1)));
            }
            var uniformMaxRow = ["UniformMaxValueRow"].concat(rows[0].slice(1).map(function () {
                return uniformMax;
            }));
            return uniformMaxRow;
        }

        charts.forEach(function (chart) {
            var data = new google.visualization.DataTable();

            data.addColumn('string', chart.title);
            columns.forEach(function (column) {
                data.addColumn(column.type, column.description);
            });

            data.addRows(chart.rows.concat([
                makeUniformMaxValueRow(chart.rows, groupSizes)
            ]));

            var series = {};
            var groupIndex = 0;
            var processedRows = 0;
            groupSizes.forEach(function (size) {
                for (var rowIndex = 0; rowIndex < size; rowIndex++) {
                    series[rowIndex + processedRows] = {targetAxisIndex: groupIndex};
                }
                processedRows += size;
                groupIndex++;
            });

            var options = {
                legend: {position: "none"},
                isStacked: true,
                series: series,
                hAxis: {textStyle: {fontSize: 0}}, // hide very large labels...
                title: chart.title
            };

            var div = document.createElement('div');
            var container = document.getElementById('charts');
            container.appendChild(div);
            var chart = new google.charts.Bar(div);
            chart.draw(data, google.charts.Bar.convertOptions(options));
        });
    }
}
