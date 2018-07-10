var appMixture = {
    events: {
        updateModel: function (e) {
            var e = $(e.target);
            if (e.attr('type') == 'checkbox') {
                this.model.set(e.attr('name') || e.attr('id'), e.prop('checked'));
            } else {
                this.model.set(e.attr('name') || e.attr('id'), !e.hasClass('selectized') ? e.val() : e.val().length > 0 ? e.val().split(',') : []);
            }
        }
    },
    models: {},
    views: {}
};

appMixture.FormView = Backbone.View.extend({
    el: '#input',
    initialize: function () {
        var $that = this;
        this.model.on({
            'change:headers': this.updateOptions,
            'change:design': this.changeDesign,
            'change:model': this.changeModel,
            'change:outcomeC': this.changeCovariates,
            'change:outcomeL': this.changeCovariates,
            'change:outcomeR': this.changeCovariates,
            'change:covariatesSelection': this.changeCovariateList,
            'change:effects': this.changeEffectsList,
            'change:email': this.changeEmail
        }, this);
        this.$el.find('[name="covariatesSelection"]').selectize({
            plugins: ['remove_button'],
            sortField: 'order'
        });
    },
    events: {
        'change input[type="file"]': 'uploadFile',
        'change input.selectized': 'updateModel',
        'change input[type="text"]': 'updateModel',
        'keyup input[type="text"]': 'updateModel',
        'change input[type="checkbox"]': 'updateModel',
        'change select': 'updateModel',
        'click #effectsButton': 'openInteractiveEffects',
        'click #referencesButton': 'openReferenceGroups',
        'click #run': 'runCalculation',
        'click #runPredict': 'runPredictCalculation'
    },
    openInteractiveEffects: function (e) {
        e.preventDefault();
        new appMixture.InteractiveEffectsView({
            model: new appMixture.EffectsModel({
                'formModel': this.model,
                'covariatesSelection': this.model.get('covariatesSelection'),
                'effects': this.model.get('effects').slice()
            })
        });
    },
    openReferenceGroups: function (e) {
        e.preventDefault();
        new appMixture.ReferenceGroupsView({
            model: new appMixture.ReferencesModel({
                'covariatesArr': this.model.get('covariatesArr'),
                'uniqueValues': this.model.get('uniqueValues'),
                'formModel': this.model,
                'references': _.extend({}, this.model.get('references'))
            })
        });
    },
    uploadFile: function (e) {
        const MAX_UNIQUE_VALUES = 20;
        e.preventDefault();
        var $that = this;
        if (window.FileReader) {
            var file = e.target.files[0],
                reader = new window.FileReader(),
                content = "",
                block = "";
            reader.onload = function(evt) {
                var lines = $.csv.toArrays(evt.target.result);
                if (lines && lines.length > 0) {
                    var headers = lines[0];
                    var uniqueValues = {};
                    for (var j = 0; j < headers.length; ++j) {
                        uniqueValues[headers[j]] = new Set();
                    }
                    for (var i = 1; i < lines.length; ++i) {
                        for (var j = 0; j < headers.length; ++j) {
                            if (uniqueValues[headers[j]].size < MAX_UNIQUE_VALUES) {
                                uniqueValues[headers[j]].add(lines[i][j]);
                            }
                        }
                    }
                    $that.model.set({
                        'csvFile': e.target.files[0],
                        'headers': headers.sort(),
                        'uniqueValues': uniqueValues
                    });
                }
            };

            if (file) {
                reader.readAsText(file.slice());
            } else {
                $that.model.set({
                    'csvFile': null,
                    'headers': null
                });
            }
        }
    },
    updateModel: function (e) {
        e.preventDefault();
        var e = $(e.target),
            name = e.prop('name'),
            val = e.val();
        if (name.length < 1) return;
        switch (e.prop('type')) {
            case 'checkbox':
                val = e.prop('checked') || false;
                break;
            default:
                if (val === "null") val = null;;
                if (!Number.isNaN(parseInt(val))) val = parseInt(val);
                break;
        }
        this.model.set(name, val);
    },
    changeCovariateList: function () {
        var model = this.model,
            covariatesSelection = this.model.get('covariatesSelection');
        if (covariatesSelection.length > 1) {
            model.set('effects', []);
        } else {
            model.set('effects', model.get('effects').filter(function (entry) {
                return covariatesSelection.indexOf(entry.first) > -1 && covariatesSelection.indexOf(entry.second) > -1;
            }));
            model.set('references', model.get('references').filter(function (entry) {
                for (var index in entry) {
                    if (covariatesSelection.indexOf(entry[index]) < 0) {
                        return false;
                    }
                }
                return true;
            }));
        }
        this.changeCovariates.apply(this);
    },
    changeCovariates: function () {
        var model = this.model,
            covariatesSelection = model.get('covariatesSelection');

        this.updateSelectize.apply(this);
        var covariatesSelectionSplit = [];
        if (covariatesSelection !== "") {
            covariatesSelectionSplit = covariatesSelection.split(',');
            var covariatesArrNew = [];
            var covariatesArr = model.get('covariatesArr');

            _.each(covariatesSelectionSplit, function (covariate) {
                var item = _.find(covariatesArr, function (covariateObj) {
                    return covariateObj.text === covariate;
                });
                if (item) {
                    covariatesArrNew.push(item);
                } else {
                    covariatesArrNew.push({
                        text: covariate,
                        type: '',
                        category: ''
                    });
                }
            });
            model.set('covariatesArr', covariatesArrNew);
        } else {
            model.set('covariatesArr', []);
        }

        if (covariatesSelectionSplit.length > 1) {
            this.show('#effectsSet');
            this.show('#categoricalGroups');
        } else {
            this.hide('#effectsSet');
            if (covariatesSelectionSplit.length === 0) {
                this.hide('#categoricalGroups');
            } else {
                this.show('#categoricalGroups');
            }
        }
    },
    changeEffectsList: function () {
        var model = this.model
        var effects = appMixture.models.form.attributes.effects;
        var effects_String = "";
        counter = 1
        _.each(effects, function (val, attribute) {
            if (counter <= 5)
                effects_String += "<p>" + val.first + " &nbsp " + val.second + "</p>";
            counter++;
        });
        $("#effects").html(effects_String);
    },
    changeDesign: function () {
        this.$el.find('[name="model"] option:last-child').attr('disabled',(this.model.get('design') === 1));
        if (this.model.get('design') === "") {
            this.clearAfter('#designSet');
        } else {
            var modelSelect = this.$el.find('[name="model"]')[0];
            if ($(modelSelect.options[modelSelect.selectedIndex]).attr('disabled') !== undefined) {
                modelSelect.selectedIndex = 0;
                this.model.set('model','');
            }
            this.showNext('#designSet');
        }
    },
    changeEmail: function () {
        if (this.model.get('email') === "") {
            this.clearAfter('#emailSet');
        } else {
            this.showNext('#emailSet');
        }
    },
    changeModel: function () {
        if (this.model.get('model') === "") {
            this.clearAfter('#modelSet');
        } else {
            this.showNext('#modelSet');
        }
    },
    resetGroup: function () {
        this.model.set('groupValue', []);
        this.showNext.apply(this);
    },
    updateOptions: function () {
        var contents = this.model.get('headers');
        if (contents) {
            this.showNext('#fileSet');
        } else {
            this.clearAfter('#fileSet');
            return;
        }
        var optionsList = "<option value=\"\">----Select Outcome----</option>";
        if (options === null) return;
        var options = contents.map(function (e) {
            return {
                'text': e,
                'value': e
            };
        });
        for (var index = 0; index < options.length; index++) {
            optionsList += "<option value=\"" + options[index].value + "\">" + options[index].text + "</option>";
        }
        this.$el.find('[name="outcomeC"]').html(optionsList);
        this.$el.find('[name="outcomeL"]').html(optionsList);
        this.$el.find('[name="outcomeR"]').html(optionsList);
        this.$el.find('[name="covariatesSelection"]')[0].selectize.clearOptions();
        this.updateSelectize.apply(this);
    },
    updateSelectize: function() {
        var covariatesSelection = this.$el.find('[name="covariatesSelection"]')[0].selectize,
            outcomeC = this.model.get('outcomeC'),
            outcomeL = this.model.get('outcomeL'),
            outcomeR = this.model.get('outcomeR'),
            options = this.model.get('headers').map(function (e) {
                return {
                    'text': e,
                    'value': e
                };
            });
        if (outcomeC !== "") {
            options = options.filter(function(entry) { return entry.value !== outcomeC; });
            covariatesSelection.removeOption(outcomeC);
        }
        if (outcomeL !== "") {
            options = options.filter(function(entry) { return entry.value !== outcomeL; });
            covariatesSelection.removeOption(outcomeL);
        }
        if (outcomeR !== "") {
            options = options.filter(function(entry) { return entry.value !== outcomeR; });
            covariatesSelection.removeOption(outcomeR);
        }
        covariatesSelection.addOption(options);
    },
    clearAfter: function (id) {
        var next = $(id).next();
        next.find('input,select,.selectized').each(function (index, child) {
            var $child = $(child);
            if (child.selectize) {
                child.selectize.clear();
            } else {
                switch ($child.prop('tagName')) {
                    case 'SELECT':
                        child.selectedIndex = 0;
                        $child.trigger('change');
                        break;
                    case 'INPUT':
                        switch ($child.prop('type')) {
                            case 'button':
                                return;
                            case 'checkbox':
                                $child.removeAttr('checked');
                                break;
                            default:
                                $child.val('');
                                break;
                        }
                        $child.trigger('change');
                        break;
                }
            }
        });
        next.removeClass('show');
    },
    showNext: function (id) {
        $(id).next().addClass('show');
    },
    show: function (id) {
        $(id).addClass('show');
    },
    hide: function (id) {
        $(id).removeClass('show');
    }
});

appMixture.InteractiveEffectsView = Backbone.View.extend({
    initialize: function () {
        this.template = _.template(appMixture.templates.get('effects'));
        this.model.on({
            'change:effects': this.rerenderFooter,
            'change:first': this.rerenderSelects,
            'change:second': this.rerenderSelects
        }, this);
        this.render();
    },
    events: {
        'hidden.bs.modal': 'remove',
        'change select': 'updateModel',
        'click .glyphicon-plus': 'addEffect',
        'click .glyphicon-remove': 'removeEffect',
        'click .modal-footer button.save': 'save',
        'click .modal-footer button:not(.save)': 'close'
    },
    addEffect: function (e) {
        var model = this.model,
            first = model.get('first'),
            second = model.get('second'),
            effects = model.get('effects');
        effects.push({
            'first': first < second ? first : second,
            'second': first < second ? second : first
        });
        model.set({
            'first': '',
            'second': ''
        });
        model.trigger('change:effects', model);
    },
    close: function (e) {
        e.preventDefault(e);
        this.$modal.close();
    },
    removeEffect: function (e) {
        var e = $(e.target)
        model = this.model,
            effects = model.get('effects');
        effects.splice(e.prop('data-index'), 1);
        model.trigger('change:effects', model);
    },
    save: function (e) {
        e.preventDefault(e);
        this.model.get('formModel').set('effects', this.model.get('effects'));
        this.close.call(this, e);
    },
    updateModel: appMixture.events.updateModel,
    render: function () {
        this.$modal = BootstrapDialog.show({
            buttons: [{
                cssClass: 'btn-primary save',
                label: 'Save'
            }, {
                cssClass: 'btn-primary',
                label: 'Close'
            }],
            message: $(this.template(this.model.attributes)),
            title: "Enter Interactive Effects"
        });
        this.setElement(this.$modal.getModal());
        this.rerenderSelects.apply(this);
        this.rerenderFooter.apply(this);
    },
    rerenderSelects: function () {
        var model = this.model,
            effects = model.get('effects'),
            first = model.get('first'),
            second = model.get('second'),
            firstList = model.get('covariatesSelection').split(',').filter(function (entry) {
                return entry !== second;
            }),
            secondList = model.get('covariatesSelection').split(',').filter(function (entry) {
                return entry !== first;
            }),
            eF = this.$el.find('[name="first"]'),
            eS = this.$el.find('[name="second"]'),
            selectedIndex = 0;
        eF.empty().append($('<option>', {
            text: "---Select Covariate---",
            value: ""
        }));
        firstList.forEach(function (entry, index) {
            if (entry === first) selectedIndex = index + 1;
            eF.append($('<option>', {
                text: entry,
                value: entry
            }));
        });
        eF[0].selectedIndex = selectedIndex;
        selectedIndex = 0;
        eS.empty().append($('<option>', {
            text: "---Select Covariate---",
            value: ""
        }));
        secondList.forEach(function (entry, index) {
            if (entry === second) selectedIndex = index + 1;
            eS.append($('<option>', {
                text: entry,
                value: entry
            }));
        });
        eS[0].selectedIndex = selectedIndex;
        first = this.model.get('first');
        second = this.model.get('second');
        var alreadyInserted = effects.length > 0 ? effects.filter(function (entry) {
            return entry.first == (first < second ? first : second) && entry.second == (first < second ? second : first);
        }).length > 0 : false;
        if (first === '' || second === '' || alreadyInserted) {
            this.$el.find('.glyphicon-plus').attr('disabled', true);
        } else {
            this.$el.find('.glyphicon-plus').removeAttr('disabled');
        }
    },
    rerenderFooter: function () {
        this.$el.find('tfoot').empty().append(_.template(appMixture.templates.get('effectsFooter'))(this.model.attributes));
    }
});

appMixture.ReferenceGroupsView = Backbone.View.extend({
    initialize: function () {
        this.template = _.template(appMixture.templates.get('references'));
        this.model.on({
            'change:covariatesArr': this.updateView
        }, this);
        this.render();
    },
    events: {
        'hidden.bs.modal': 'remove',
        'change select': 'updateModel',
        'change input[type="text"]': 'updateModel',
        'click .modal-footer button.save': 'save',
        'click .modal-footer button:not(.save)': 'close'
    },
    close: function(e) {
        e.preventDefault(e);
        this.$modal.close();
    },
    save: function(e) {
        e.preventDefault(e);
        this.model.get('formModel').set('covariatesArr', this.model.get('covariatesArr'));
        this.close.call(this, e);
    },
    updateModel: function(e) {
        var model = this.model,
            input = $(e.target),
            covariatesArr = model.get('covariatesArr'),
            name = (input.attr('name') || input.attr('id')).split('_'),
            value = input.val(),
            type = name.splice(name.length-1,1)[0];
        name = name.join('_');

        var covariateObj = _.find(covariatesArr, function (obj) {
            return obj.text === name;
        });
        covariateObj[type] = input.val();
        if (type === 'type') {
            if (value === 'continuous') {
                covariateObj.category = '0';
            } else if (value === 'nominal') {
            } else {
                covariateObj.category = '';
            }
        }
        model.trigger('change:covariatesArr', model);
    },
    updateView: function() {
        var model = this.model,
            covariatesArr = model.get('covariatesArr'),
            $that = this;
        covariatesArr.forEach(function(entry) {
            var name = entry.text,
                type = entry.type,
                category = entry.category;
                eType = $that.$el.find('[name="'+name+'_type"]'),
                eCatText = $that.$el.find('[id="'+name+'_category_text"]');
                eCatSelect = $that.$el.find('[id="'+name+'_category_select"]');
            if (type != eType.val()) {
                eType.find('option[value="'+type+'"]').prop('selected',true);
            }
            if (category != eCatText.val()) {
                eCatText.val(category);
            }
            if (type === 'continuous') {
                eCatText.prop('hidden', false);
                eCatSelect.prop('hidden', true);
            } else if (type === 'nominal') {
                eCatText.prop('hidden', true);
                eCatSelect.prop('hidden', false);
            } else {
                eCatText.val('');
                eCatSelect.val('');
                eCatText.prop('hidden', true);
                eCatSelect.prop('hidden', true);
            }
        });
    },
    render: function() {
        this.$modal = BootstrapDialog.show({
            buttons: [{
                cssClass: 'btn-primary save',
                label: 'Save'
            }, {
                cssClass: 'btn-primary',
                label: 'Cancel'
            }],
            message: $(this.template(this.model.attributes)),
            title: "Select References"
        });
        this.setElement(this.$modal.getModal());
    }
});

appMixture.ResultsView = Backbone.View.extend({
    el: '#output',
    initialize: function () {
        this.model.on({
            'change': this.render
        }, this);
        this.template = _.template(appMixture.templates.get('results'), {
            'variable': 'data'
        });
    },
    render: function () {
        this.$el.addClass('show');
        this.$el.html(this.template(this.model.attributes));
        // var data = this.model.get('cumulative.hazard'),
        //     xAxis = data['xAxis'],
        //     yAxis = data['yAxis'];
        // Plotly.newPlot(
        //     'tab-hazard', [{
        //         x: xAxis,
        //         y: yAxis,
        //         model: 'lines'
        //     }], {
        //         title: "Categorical Variables",
        //         xaxis: {
        //             title: "Time"
        //         },
        //         yaxis: {
        //             title: "Cumulative Hazard"
        //         }
        //     }
        // );
    }
});

appMixture.BaseView = Backbone.View.extend({
    el: 'body',
    events: {
        'click #run': 'onSubmit',
        'click #runPredict':'onSubmitPredict'
    },
    onSubmit: function (e) {
        e.preventDefault();
        var $that = this,
            params = _.extend({}, this.model.get('form').attributes);
        var formData = new FormData();
        params.covariatesSelection = params.covariatesSelection.split(';');
        for (var index in params) {
            formData.append(index, params[index]);
        }
        this.model.get('results').fetch({
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            type: "POST"
        });

    },
    onSubmitPredict: function (e) {
        e.preventDefault();
        var $that = this,
            params = _.extend({}, this.model.get('form').attributes);
        var formData = new FormData();

        params.covariatesSelection = params.covariatesSelection.split(';');
        for (var index in params) {
            formData.append(index, params[index]);
        }

        formData.append("Rfile",appMixture.ResultsModel.prototype.defaults.Rfile)
        console.log('parameters', params)
        $.ajax({
          url: '/predictDummy',
          data: formData,
          processData: false,
          contentType: false,
          type: 'POST',
          success: function(data){
            var dataArr = $.parseJSON(data);

            var headers = Object.keys(dataArr[0]);
            var values = [];
            dataArr.forEach(function(element){
                 var arr = [];
                 headers.forEach(function(header) {
                    arr.push(element[header]);
                 });
                 values.push(arr);
            });
            var predictionResults = {
                 headers: headers,
                 values: values
            };

            $that.model.get('results').set('prediction.results', predictionResults);

            console.log($that.model.get('results'));
            $that.model.get('results').trigger('change');

          }
        });

    }
});

$(function () {
    Number.prototype.countDecimals = function () {
        if (Math.floor(this.valueOf()) === this.valueOf()) return 0;
        return this.toString().split(".")[1].length || 0;
    }
    appMixture.templates = new appMixture.TemplatesModel();
    appMixture.templates.fetch().done(function () {
        appMixture.models.form = new appMixture.FormModel();
        appMixture.models.results = new appMixture.ResultsModel();
        appMixture.models.base = new appMixture.BaseModel({
            'form': appMixture.models.form,
            'results': appMixture.models.results
        });
        appMixture.views.base = new appMixture.BaseView({
            model: appMixture.models.base
        });
        appMixture.views.form = new appMixture.FormView({
            model: appMixture.models.form
        });
        appMixture.views.results = new appMixture.ResultsView({
            model: appMixture.models.results
        });
    });
});