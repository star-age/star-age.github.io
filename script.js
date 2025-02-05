var layout = {
    paper_bgcolor:'rgba(0,0,0,0)',
    plot_bgcolor:'rgba(0,0,0,0)',
    width:  650,
    height: 650,
    xaxis: {
        gridcolor: 'rgba(0.5,0.5,0.5,.5)',
        title: {text: 'BP-RP'},
        linewidth:0,
        range: [-1,3],
        zeroline: false,
        fixedrange: true
    },
    yaxis: {
        gridcolor: 'rgba(0.5,0.5,0.5,.5)',
        title: {text: 'MG'},
        linewidth:0,
        zorder:3,
        range:[10,-5],
        zeroline: false,
        fixedrange: true
    },
    showlegend: false,
    margin:{
            l: 50,
            r: 50,
            b: 50,
            t: 50,
            pad: 0
        }
};

var histogram_layout = {
    paper_bgcolor:'rgba(0,0,0,0)',
    plot_bgcolor:'rgba(0,0,0,0)',
    width:  650,
    height: 250,
    xaxis: {
        gridcolor: 'rgba(235, 232, 221,.25)',
        title: {text: 'Age (Gyr)',font:{color:'#ebe8dd'}},
        linewidth:2,
        color:'#ebe8dd',
        range: [0,14],
        zeroline: false,
        fixedrange: true,
        showticklabels: true
    },
    yaxis: {
        gridcolor: 'rgba(0,0,0,0)',
        title: {text: 'Distribution',font:{color:'#ebe8dd'}},
        linewidth:0,
        color:'#ebe8dd',
        zorder:3,
        zeroline: false,
        fixedrange: true,
        showticklabels: false
    },
    showlegend: false,
    margin:{
            l: 50,
            r: 50,
            b: 50,
            t: 50,
            pad: 0
        }
};

var config = {
    displayModeBar: false
};

var data = [];
var isochrone_curves = [];
var n_traces = 0;
var n_histograms = 0;
var population = [];
var is_population = false;
var n_pop = 0;

function data_space_to_pixel_space(layout,data_size,direction) {
    if (direction == 'x'){
        var range = layout.xaxis.range[1] - layout.xaxis.range[0];
        var pixels = layout.width;
    }
    else {
        var range = layout.yaxis.range[1] - layout.yaxis.range[0];
        var pixels = layout.height;
    }
    return data_size * pixels / range;
}

function draw_gaussian_point(x, y, std_x, std_y) {
    if (data.length == 0) {
            var gaussian = {
            x: [x],
            y: [y],
            error_x: {
                type: 'data',
                array: [std_x],
                visible: true,
                width: 0
            },
            error_y: {
                type: 'data',
                array: [std_y],
                visible: true,
                width: 0
            },
            mode: 'markers',
            marker: {
                symbol: 'star',
                size: 7,
                color: 'rgba(0,0,0,1)'
            },
            hovertext: '',
            hoverinfo: 'none',
            zorder:2,
            visible: false
        };
        data = [gaussian];
        Plotly.newPlot('hr_diagram', data, layout, config);
    } else {
        data[0].x = [x];
        data[0].y = [y];
        data[0].error_x.array = [std_x];
        data[0].error_y.array = [std_y];
        data[0].visible = true;
        Plotly.redraw('hr_diagram');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    Plotly.newPlot('hr_diagram',data, layout, {displayModeBar: false});
    Plotly.newPlot('age_distribution',[], histogram_layout, {displayModeBar: false});
    update_errors();
    set_controls();
    add_axes();
    var model = document.getElementById("model").value;
    plot_isochrones(model);
    document.getElementById('hr_diagram').addEventListener('click', function(event) {
        var bb = event.target.getBoundingClientRect();
        var x = document.getElementById('hr_diagram')._fullLayout.xaxis.p2d(event.clientX - bb.left);
        var y = document.getElementById('hr_diagram')._fullLayout.yaxis.p2d(event.clientY - bb.top);
        update_inputs(x,y);
        submit_star();
    });
    document.getElementById("model").addEventListener('change', function() {
        var model = document.getElementById("model").value;
        plot_isochrones(model);
        submit_star();
    });

    $('#import_div').click(function() {
        import_csv();
    });
});

function reset_import_button(){
    is_population = false;
    population = [];
    data[0].visible = true;
    n_pop = 0;

    $('#submit').html('<div class="stars"></div>Estimate age<div class="stars"></div>');
    $('#MoH_input').attr('disabled', false);
    $('#MG_input').attr('disabled', false);
    $('#BP_RP_input').attr('disabled', false);
    $('label[for="MoH_input"]').attr('disabled', false);
    $('label[for="MG_input"]').attr('disabled', false);
    $('label[for="BP_RP_input"]').attr('disabled', false);

    Plotly.deleteTraces('hr_diagram',-1);
    Plotly.redraw('hr_diagram');
    submit_star();

    $('#import_div').html('<i class="fa-solid fa-file-import"></i>Import a csv file');
}

function populate_cmd(stars) {
    if (n_pop > 0) {
        Plotly.deleteTraces('hr_diagram',-1);
    }

    is_population = true;
    data[0].visible = false;

    population = stars;

    submit_population();
}

async function submit_population() {
    var xs = [];
    var ys = [];
    var all_ages = [];

    for (var i = 0; i < population.length; i++) {
        var star = population[i];
        var MG = star['MG'];
        var BP_RP = star['BP-RP'];
        var MoH = star['[M/H]'];

        var e_MG = document.getElementById("eMG_input").value;
        var e_BP_RP = document.getElementById("eBP_RP_input").value;
        var e_MoH = document.getElementById("eMoH_input").value;

        var model_name = document.getElementById("model").value;
        var n = document.getElementById("n_input").value;

        var [ages,_age,_age_std] = await estimate_age(model_name, MG, MoH, BP_RP, e_MG, e_MoH, e_BP_RP, n);
        for (var j = 0; j < ages.length; j++) {
            if (isNaN(ages[j])) continue;
            all_ages.push(ages[j]);
        }

        xs.push(BP_RP);
        ys.push(MG);
    }

    plot_age_distribution(all_ages);
    
    var points = {
        x: xs,
        y: ys,
        mode: 'markers',
        marker: {
            symbol: 'star',
            size: 7,
            color: 'rgba(0,0,0,1)'
        },
        hovertext: '',
        hoverinfo: 'none',
        zorder:2,
        visible: true
    };
    Plotly.addTraces('hr_diagram', points);
    n_pop = xs.length;

    var age = 0;
    all_ages.sort((a, b) => a - b);
    var mid = Math.floor(all_ages.length / 2);
    age = all_ages.length % 2 !== 0 ? all_ages[mid] : (all_ages[mid - 1] + all_ages[mid]) / 2;
    var age_std = Math.sqrt(all_ages.reduce((sum, a) => sum + Math.pow(a - age, 2), 0) / all_ages.length);

    document.getElementById("result").innerHTML = 't = ' + age.toFixed(2) + '±' + age_std.toFixed(2) + ' Gyr';
}

function import_csv() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = function(event) {
        var file = event.target.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var csv = e.target.result;
                Papa.parse(csv, {
                    header: true,
                    dynamicTyping: true,
                    complete: function(results) {
                        $('#submit').html('<div class="stars"></div>Estimate ages<div class="stars"></div>');
                        $('#MoH_input').attr('disabled', true);
                        $('#MG_input').attr('disabled', true);
                        $('#BP_RP_input').attr('disabled', true);
                        $('label[for="MoH_input"]').attr('disabled', true);
                        $('label[for="MG_input"]').attr('disabled', true);
                        $('label[for="BP_RP_input"]').attr('disabled', true);
                        var close = $('i').addClass('fa-solid fa-xmark');
                        $('#import_div').empty();
                        $('#import_div').append('<i class="fa-solid fa-file"></i>' + file.name);
                        $('#import_div').append(close);
                        close.click(function(ev) {
                            ev.stopPropagation();
                           reset_import_button();
                        });
                        populate_cmd(results.data);
                    }
                });
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function update_inputs(x, y) {
    if (is_population == true) {
        reset_import_button();
        is_population = false;
    }
    document.getElementById("MG_input").value = y.toFixed(2);
    document.getElementById("BP_RP_input").value = x.toFixed(2);
}

function set_controls() {
    var sliders = [
        {range: "eMoH_range", input: "eMoH_input"},
        {range: "eMG_range", input: "eMG_input"},
        {range: "eBP_RP_range", input: "eBP_RP_input"}
    ];

    sliders.forEach(function(slider) {
        var rangeElement = document.getElementById(slider.range);
        var inputElement = document.getElementById(slider.input);
        inputElement.value = rangeElement.value;
        rangeElement.oninput = function() {
            inputElement.value = this.value;
            submit_star();
        }
        inputElement.oninput = function() {
            rangeElement.value = this.value;
            submit_star();
        }
    });

    var ranges = [
        {input: "MoH_input"},
        {input: "MG_input"},
        {input: "BP_RP_input"}
    ];

    ranges.forEach(function(r) {
        var inputElement = document.getElementById(r.input);
        inputElement.oninput = function() {
            submit_star();
        }
    });

    document.getElementById("n_input").oninput = function() {
        if (data[0].visible == true) {
            submit_star();
        }
    }

    document.getElementById("model").onclick = function() {
        if (data[0].visible == true) {
            submit_star();
        }
    }
}

function update_errors() {
    var MG = document.getElementById("MG_input").value;
    var BP_RP = document.getElementById("BP_RP_input").value;

    var eMG = document.getElementById("eMG_input").value;
    var eBP_RP = document.getElementById("eBP_RP_input").value;

    draw_gaussian_point(parseFloat(BP_RP), parseFloat(MG), parseFloat(eBP_RP), parseFloat(eMG));
}

async function submit_star() {
    var MG = document.getElementById("MG_input").value;
    var MoH = document.getElementById("MoH_input").value;
    var BP_RP = document.getElementById("BP_RP_input").value;

    var eMG = document.getElementById("eMG_input").value;
    var eMoH = document.getElementById("eMoH_input").value;
    var eBP_RP = document.getElementById("eBP_RP_input").value;

    var model_name = document.getElementById("model").value;
    var n = document.getElementById("n_input").value;

    if (MoH == "") {
        document.getElementById("MoH_input").value = '0.0';
        MoH = 0.0;
    }

    if (n == "") {
        n = 10_000;
        document.getElementById("n_input").value = n;
    }

    if (is_population == true) {
        submit_population();
        return;
    }

    if (MG == "" || BP_RP == "") {
        return;
    }

    var [ages,age,age_std] = await estimate_age(model_name, MG, MoH, BP_RP, eMG, eMoH, eBP_RP, n);
    document.getElementById("result").innerHTML = 't = ' + age.toFixed(2) + '±' + age_std.toFixed(2) + ' Gyr';
    data[0].hovertext = age.toFixed(2) + '±' + age_std.toFixed(2) + ' Gyr';
    data[0].hoverinfo = 'text';
    Plotly.redraw('hr_diagram');
    plot_age_distribution(ages);
    update_errors();
}

function load_model(model_name) {
    return new Promise((resolve, reject) => {
        $.getJSON('models/NN_' + model_name + '.json', function(data) {
            var weights = data['weights'];
            var biases = data['biases'];
            var means = data['means'];
            var stds = data['stds'];
            resolve([weights, biases, means, stds]);
        }).fail(function() {
            reject("Error loading model");
        });
    });
}

function load_isochrones(model) {
    return new Promise((resolve, reject) => {
        $.getJSON('isochrones/isochrones_' + model + '.json', function(data) {
            resolve(data);
        }).fail(function() {
            reject("Error loading isochrone");
        });
    });
}

function remove_isochrones() {
    for (var i = 0; i < n_traces; i++) {
        Plotly.deleteTraces('hr_diagram',-1);
    }
}

async function plot_isochrones(model) {
    try {
        remove_isochrones();
        var MG_min = 0;
        var MG_max = 0;
        var BP_RP_min = 0;
        var BP_RP_max = 0;
        var isochrones = await load_isochrones(model);
        var traces = [];
        n_traces = isochrones.length;
        isochrone_curves = [];
        for (var i = 0; i < isochrones.length; i++) {
            var isochrone = isochrones[i];
            var x = isochrone['BP-RP'];
            var y = isochrone.MG;
            
            /*
            while (x.length > 1000) {
                x = x.filter((e,i) => i % 2 == 0);
                y = y.filter((e,i) => i % 2 == 0);
            }
            */

            //x = x.slice(500, -1);
            //y = y.slice(500, -1);
            
            var x_min = Math.min.apply(null, x);
            var x_max = Math.max.apply(null, x);
            var y_min = Math.min.apply(null, y);
            var y_max = Math.max.apply(null, y);
            if (x_min < BP_RP_min) {
                BP_RP_min = x_min;
            }
            if (x_max > BP_RP_max) {
                BP_RP_max = x_max;
            }
            if (y_min < MG_min) {
                MG_min = y_min;
            }
            if (y_max > MG_max) {
                MG_max = y_max;
            }
            
            var trace = {
                x: x,
                y: y,
                mode: 'lines',
                line: {
                    color: 'rgba(82, 140, 92,.25)',
                    width: 1
                },
                hovertext: isochrone.age + ' Gyr',
                hoverinfo: 'text',
                zorder:1
            }
            isochrone_curves.push(trace);
            traces.push(trace);
        }
        layout.xaxis.linewidth = 2;
        Plotly.addTraces('hr_diagram', traces);
        //make_isochrones_hoverable();
    } catch (error) {
        console.log(error);
    }
}

function make_isochrones_hoverable() {
    document.getElementById('hr_diagram').on('plotly_hover', function(data){
        var update = {'line':{color:'rgba(82, 140, 92,1)',width:2}};
        var i_curve = data.points[0].curveNumber;
        Plotly.restyle('hr_diagram', update, [i_curve]);
      });
      
      document.getElementById('hr_diagram').on('plotly_unhover', function(data){
        var update = {'line':{color:'rgba(82, 140, 92,.25)',width:1}};
        var i_curve = data.points[0].curveNumber;
        Plotly.restyle('hr_diagram', update, [i_curve]);
    });
}

function add_axes() {
    var x_min = layout.xaxis.range[0];
    var x_max = layout.xaxis.range[1];
    var y_min = layout.yaxis.range[0];
    var y_max = layout.yaxis.range[1];
    var x = [x_min,x_max,x_max,x_min,x_min];
    var y = [y_max,y_max,y_min,y_min,y_max];
    var trace = {
        x: x,
        y: y,
        mode: 'lines',
        line: {
            color: 'rgba(0,0,0,0.5)',
            width: 4
        }
    }
    Plotly.addTraces('hr_diagram', trace);
}

async function estimate_age(model_name, MG, MoH, BP_RP, eMG, eMoH, eBP_RP, n) {
    try {
        var [weights, biases, means, stds] = await load_model(model_name);
        MoH = parseFloat(MoH);
        MG = parseFloat(MG);
        BP_RP = parseFloat(BP_RP);
        var ages = [];
        for (var i = 0; i < n; i++) {
            var a_new = [
                gaussianRandom(MoH, parseFloat(eMoH)),
                gaussianRandom(MG, parseFloat(eMG)),
                gaussianRandom(BP_RP, parseFloat(eBP_RP))
            ]
            age = predict_nn(weights, biases, means, stds, a_new, n);
            ages.push(age[0]);
        }
        var age = 0;
        ages.sort((a, b) => a - b);
        var mid = Math.floor(ages.length / 2);
        age = ages.length % 2 !== 0 ? ages[mid] : (ages[mid - 1] + ages[mid]) / 2;
        age_std = Math.sqrt(ages.reduce((sum, a) => sum + Math.pow(a - age, 2), 0) / ages.length);
        return [ages, age, age_std];
    } catch (error) {
        console.log(error);
    }
    
}

function plot_age_distribution(ages) {
    if (n_histograms > 0) {
        Plotly.deleteTraces('age_distribution',0);
    }
    var trace = {
        x: ages,
        type: 'histogram',
        xbins: {
            size: 0.1,
            start: 0,
            end: 14
        },
        autobinx: false,
        ybins: {
            size: 0.1,
            start: 0,
            end: 14
        },
        autobiny: false,
        marker: {
            color: 'rgba(235, 232, 221,.75)'
        },
        hoverinfo: 'x',
    }
    Plotly.addTraces('age_distribution', trace);
    n_histograms = 1;
}

function scale(x, means, stds) {
    return x.map((e,i) => (e - means[i]) / stds[i]);
}

function predict_nn(weights, biases, means, stds, a, n) {
    a = scale(a, means, stds);
    for (var i = 0; i < weights.length; i++) {
        a = dot(a,weights[i]).map((e,j) => e + biases[i][j]);
        a = relu(a);
    }
    return a;
}

function gaussianRandom(mean=0, stdev=1) {
    const u = 1 - Math.random(); // Converting [0,1) to (0,1]
    const v = Math.random();
    const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
    // Transform to the desired mean and standard deviation:
    return z * stdev + mean;
}

function relu(x) {
    for (var i = 0; i < x.length; i++) {
        x[i] = Math.max(0, x[i]);
    }
    return x;
}

function dot(x,y) {
    var result = [];
    for (var i = 0; i < y[0].length; i++) {
        var sum = 0;
        for (var j = 0; j < x.length; j++) {
            sum += x[j] * y[j][i];
        }
        result.push(sum);
    }
    return result;
}