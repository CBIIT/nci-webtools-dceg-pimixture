appMixture.PredictionView = Backbone.View.extend({
    el: '#prediction-tool',
    events: {
        'change #rdsFile': 'selectModelFile',
        'change #testDataFile': 'selectTestDataFile',
        'change input[type="number"]': 'updateModel',
        'change input[type="text"]': 'updateModel',
        'click #reset': 'resetForm',
        'submit #predictionForm':'onSubmitPredict',
        'click #timePointRange': 'changeTimePointType',
        'click #timePointList': 'changeTimePointType'
    },
    initialize: function () {
        this.template = _.template(appMixture.templates.get('prediction'), {
            'variable': 'data'
        });

        this.model.on({
            'change:results': this.render,
            'change:maxTimePoint': this.updateMaxTimePoint
        }, this);

        appMixture.models.predictionResultModel = new appMixture.PredictionResultModel();
    },
    render: function () {
        this.checkRemoteRFile();
        this.$el.html(this.template(this.model.attributes));
        this.$("[data-toggle=popover]").popover();
        this.tryEnableInputs();
        appMixture.predictionResultView = new appMixture.PredictionResultView({model: appMixture.models.predictionResultModel});
        this.$el.append(appMixture.predictionResultView.render().el);
        this.initializePopovers();
        return this;
    },
    checkRemoteRFile: function() {
        $that = this;
        var remoteRFile = this.model.get('remoteRFile');
        var fileName = this.model.get('fileName');
        if (remoteRFile) {
            var formData = new FormData();
            formData.append('s3file', JSON.stringify(remoteRFile));
            formData.append('id', this.model.get('id'));
            formData.append('jobName', this.model.get('jobName'));
            this.uploadModelFile(formData);
            this.model.unset('remoteRFile');
        }
    },
    initializePopovers: function() {
        this.$('#testDataPopover').popover({title: "Prediction", content: 'Based on the regression parameters and/or cumulative hazard function, we can predict prevalence and incidence using an independent data (called test data) including the predictors used for estimating the parameters and cumulative hazard function. For prediction, users need to upload fitted model, test data and input time points. When time point=0, predicted probabilities mean the prevalence of subgroups characterized by specific predictors; when time point=t>0, predicted cumulative risk up to time t includes prevalence too. Test data should include the same variables used for fitting the model.',  trigger:"focus", container:"body", html: true});
        this.$('#modelFilePopover').popover({title: "Model File", content: 'Upload model (.RDS) file downloaded from "Fitting" page',  trigger:"focus", container:"body", html: true});
        this.$('#timePointTypePopover').popover({title: "Time Point Type", content: 'You can enter time points as a range (default), or enter discrete time points manually.',  trigger:"focus", container:"body", html: true});
        this.$('#beginPopover').popover({title: "Begin", content: 'First time point you\'d like to use as time points',  trigger:"focus", container:"body", html: true});
        this.$('#endPopover').popover({title: "End", content: 'Last time point you\'d like to use as time points',  trigger:"focus", container:"body", html: true});
        this.$('#stepSizePopover').popover({title: "Step Size", content: 'Step size between consecutive time points',  trigger:"focus", container:"body", html: true});
        this.$('#timePointsPopover').popover({title: "Time Points", content: 'Enter discrete time points manually',  trigger:"focus", container:"body", html: true});
    },
    uploadModelFile: function(formData) {
        $that = this;
        this.model.fetch({
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            type: "POST",
            success: function(model, res, options) {
                appMixture.models.predictionResultModel.unset('errors');
                if ($that.model.get('serverFile')) {
                    $that.render();
                }
            },
            error: function(model, res, options) {
                console.log(res.responseText);
                appMixture.models.predictionResultModel.set('errors', res.responseText);
            }
        });
    },
    selectModelFile: function(e) {
        var $that = this;
        var file = this.model.get('rdsFile');
        if (e) {
            file = e.target.files[0];
        }
        if (file) {
            var formData = new FormData();
            formData.append('rdsFile', file);
            this.uploadModelFile(formData);
            this.model.set('rdsFile', file);
            this.$('#modelFileName').html(file.name);
            this.$('#modelFileBtn').prop('disabled', true);
            this.tryEnableInputs();
        }
    },
    updateMaxTimePoint: function(e) {
        var maxTimePoint = this.model.get('maxTimePoint');
        this.$('#end').prop('max', maxTimePoint);
        this.$('#begin').prop('max', maxTimePoint);
    },
    selectTestDataFile: function(e) {
        var file = e.target.files[0];
        if (file) {
            this.model.set('testDataFile', file);
            this.$('#testDataFileName').html(file.name);
            this.$('#testDataFileBtn').prop('disabled', true);
            this.tryEnableInputs();
        }
    },
    updateModel: function(e) {
        var val = $(e.target).val();
        var name = $(e.target).attr('name');
        this.model.set(name, val);
        if (name === 'timePoints') {
            var points = val.split(',').map(function(point) { return point.trim()} );
            for (var point of points) {
                if (point) {
                    if (!this.validateTimePoint(point, 'timePointsError', this.$('#timePointsError'))) {
                        return;
                    }
                }
            }
        }

        if (name === 'begin') {
            if (this.validateTimePoint(val, 'beginError', this.$('#beginError'))) {
                this.$('#end').prop('min', val);
            }
        } else if (name === 'end') {
            this.validateTimePoint(val, 'endError', this.$('#endError'))
        }
    },
    validateTimePoint: function(point, errorField, errorElement) {
        this.model.unset(errorField);
        if (errorElement.html) {
            errorElement.html('');
        }
        var num = parseInt(point);
        var maxTimePoint = this.model.get('maxTimePoint');
        var error = '';
        if (Number.isNaN(num)) {
            error = 'Invalid time point "' + point + '"';
            this.model.set(errorField, error);
            if (errorElement.html) {
                errorElement.html(error);
            }
            return false;
        } else if (num > maxTimePoint) {
            error = 'Time point can\'t be greater than "' + maxTimePoint + '"';
            this.model.set(errorField, error);
            if (errorElement.html) {
                errorElement.html(error);
            }
            return false;
        }
        return true;
    },
    tryEnableInputs: function() {
        var modelFileSelected = this.model.get('serverFile');
        if (!modelFileSelected) {
            modelFileSelected = this.model.get('rdsFile').name;
        }
        var testDataFileSelected = this.model.get('testDataFile').name;
        if (modelFileSelected || testDataFileSelected) {
            this.$('#reset').prop('disabled', false);
        }
        if (modelFileSelected && testDataFileSelected) {
            this.$('#timePointsWell').prop('disabled', false);
            this.$('#runPredict').prop('disabled', false);
        }
    },
    resetForm: function(e) {
        appMixture.models.predictionResultModel.clear({silent: true}).set(appMixture.models.predictionResultModel.defaults, {silent: true});
        this.model.clear({silent: true}).set(this.model.defaults, {silent: true});
        this.render();
    },
    onSubmitPredict: function (e) {
        e.preventDefault();
        if (this.model.get('timePointType') === 'List' && this.model.get('timePointsError')) {
            return;
        } else if (this.model.get('timePointType') === 'Range' &&
            (this.model.get('beginError') || this.model.get('endError'))) {
            return;
        }
        var $that = this;
        var formData = new FormData();
        var jsonData = {};

        var serverFile = this.$('[name="serverFile"]').val() || this.model.get('serverFile');
        var uploadedFile = this.model.get('uploadedFile');
        if (serverFile) {
            jsonData["serverFile"] = serverFile;
            jsonData['jobName'] = this.model.get('jobName');
        } else if (uploadedFile) {
            jsonData["uploadedFile"] = uploadedFile;
            this.model.unset('uploadedFile');
            jsonData['jobName'] = this.model.get('jobName');
        } else if (this.model.get('rdsFile')) {
            formData.append('rdsFile', this.model.get('rdsFile'));
            jsonData['jobName'] = this.model.get('rdsFile').name.replace(/\.rds$/, '');
        } else {
            appMixture.models.predictionResultModel.set('errors', 'Please choose a valid model file!');
            return;
        }

        if (this.model.get('testDataFile')) {
            formData.append('testDataFile', this.model.get('testDataFile'));
        } else {
            appMixture.models.predictionResultModel.set('errors', 'Please choose a valid test data file!');
            return;
        }

        if (this.model.get('timePointType') === 'List') {
            jsonData.timePoints = this.model.get('timePoints').split(',');
        } else {
            jsonData["begin"] = this.model.get('begin');
            jsonData["end"] = this.model.get('end');
            jsonData["stepSize"] = this.model.get('stepSize');
        }
        formData.append('jsonData', JSON.stringify(jsonData));

        appMixture.models.predictionResultModel.clear({silent: true}).set(appMixture.models.predictionResultModel.defaults, {silent: true});
        appMixture.predictionResultView.render();
        this.startSpinner();
        appMixture.models.predictionResultModel.fetch({
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            type: "POST",
            success: function(model, res, options) {
                $that.stopSpinner();
            },
            error: function(model, res, options) {
                $that.stopSpinner();
                if (res.status == 410) { // rds file on server doesn't exist anymore
                    var redirect = confirm("Model file on server doesn't exist anymore!\nUpload a new model file?");
                    if (redirect) {
                        console.log("Redirect");
                        appMixture.router.navigate('#prediction', true);
                        return;
                    } else {
                        console.log("Stay");
                    }
                }

                if (res.responseText) {
                    var error = res.responseText.replace(/\\n/g, '<br>');
                    error = error.replace(/^"(.*)"\n$/, '$1');
                    error = error.replace(/\\"/g, '"');
                    error = 'Error message from R package:<br>' + error;
                    appMixture.models.predictionResultModel.set('errors', error);
                }
            }
        });
    },
    changeTimePointType: function(e) {
        if (e.target.id === "timePointRange") {
            this.model.set('timePointType', 'Range');
            this.$('#timePointsRangeGroup').prop('hidden', false);
            this.$('#timePointsRangeGroup input').prop('required', true);
            this.$('#timePointsListGroup').prop('hidden', true);
            this.$('#timePointsListGroup input').prop('required', false);
        } else if (e.target.id === "timePointList") {
            this.model.set('timePointType', 'List');
            this.$('#timePointsListGroup').prop('hidden', false);
            this.$('#timePointsListGroup input').prop('required', true);
            this.$('#timePointsRangeGroup').prop('hidden', true);
            this.$('#timePointsRangeGroup input').prop('required', false);
        }
    },
    startSpinner: function() {
        $('body').append('<div id="overlay"></div>');
        var target = $('#overlay')[0];
        if (this.spinner) {
            this.spinner.spin(target);
        } else {
            var opts = {
                lines: 13, // The number of lines to draw
                length: 38, // The length of each line
                width: 17, // The line thickness
                radius: 45, // The radius of the inner circle
                scale: 1, // Scales overall size of the spinner
                corners: 1, // Corner roundness (0..1)
                color: '#ffffff', // CSS color or array of colors
                fadeColor: 'transparent', // CSS color or array of colors
                speed: 1, // Rounds per second
                rotate: 0, // The rotation offset
                animation: 'spinner-line-fade-quick', // The CSS animation name for the lines
                direction: 1, // 1: clockwise, -1: counterclockwise
                zIndex: 2e9, // The z-index (defaults to 2000000000)
                className: 'spinner', // The CSS class to assign to the spinner
                top: '50%', // Top position relative to parent
                left: '50%', // Left position relative to parent
                shadow: '0 0 1px transparent', // Box-shadow for the lines
                position: 'absolute' // Element positioning
            };
            this.spinner = new Spinner(opts).spin(target);
        }
    },
    stopSpinner: function() {
        this.spinner.stop();
        $('#overlay').remove();
    }
});