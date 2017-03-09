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
        'click #run': 'runCalculation'
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
                'formModel': this.model,
                'references': _.extend({}, this.model.get('references'))
            })
        });
    },
    uploadFile: function (e) {
        e.preventDefault();
        var $that = this;
        if (window.FileReader) {
            var file = e.target.files[0],
                reader = new window.FileReader(),
                content = "",
                block = "";
            reader.onloadend = function (evt) {
                if (evt.target.readyState == FileReader.DONE) {
                    if (evt.target.result !== "\n") {
                        content += evt.target.result;
                        reader.readAsBinaryString(file.slice(content.length, content.length + 1));
                    } else {
                        content = content.replace(/\r|"/g, '').split(",").sort();
                        var i = 1;
                        $that.model.set({
                            'csvFile': e.target.files[0],
                            'headers': content
                        });
                    }
                }
            };
            if (file) {
                reader.readAsBinaryString(file.slice(content.length, content.length + 1));
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
                        categorical: false,
                        category: ''
                    });
                }
            });
            model.set('covariatesArr', covariatesArrNew);
        } else {
            model.set('covariatesArr', []);
        }

        if (model.get('outcomeC') === "" || model.get('outcomeL') === "" || model.get('outcomeR') === "" || covariatesSelection === "") {
            this.clearAfter('#covariatesSet');
        } else {
            if (covariatesSelectionSplit.length > 1) {
                this.showNext('#covariatesSet');
            } else {
                this.clearAfter('#covariatesSet');
            }
            this.showNext('#effectsSet');
            this.showNext('#referencesSet');
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
        if (this.model.get('design') === "") {
            this.clearAfter('#designSet');
        } else {
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
        var optionsList = "<option value=\"\">----Select Outcome----</option>",
            covariatesSelection = $('[name="covariatesSelection"]')[0].selectize;
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
        covariatesSelection.clearOptions();
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
        /*
        this.model.on({
        }, this);
        */
        this.render();
    },
    events: {
        'hidden.bs.modal': 'remove',
        'change input[type="checkbox"]': 'updateModel',
        'change input[type="text"]': 'updateModel',
        'click .modal-footer button.save': 'save',
        'click .modal-footer button:not(.save)': 'close'
    },
    close: function (e) {
        e.preventDefault(e);
        this.$modal.close();
    },
    save: function (e) {
        e.preventDefault(e);
        this.model.get('formModel').set('covariatesArr', this.model.get('covariatesArr'));
        this.close.call(this, e);
    },
    updateModel: function (e) {
        var model = this.model,
            input = $(e.target),
            type = input.attr('type'),
            covariatesArr = model.get('covariatesArr'),
            name = input.attr('name') || input.attr('id');

        var covariateObj = _.find(covariatesArr, function (obj) {
            return obj.text === name;
        });

        if (type === 'checkbox') {
            var isChecked = input.prop('checked');
            covariateObj.categorical = isChecked;
            if (!isChecked) {
                covariateObj.category = '';
            }

        } else if (type === 'text') {
            covariateObj.category = input.val();
        }
        this.$modal.close();
        this.render();
        // model.trigger('change:covariatesArr', model);
    },
    render: function () {
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
        var data = this.model.get('cumulative.hazard'),
            xAxis = data['xAxis'],
            yAxis = data['yAxis'];
        Plotly.newPlot(
            'tab-hazard', [{
                x: xAxis,
                y: yAxis,
                model: 'lines'
            }], {
                title: "Categorical Variables",
                xaxis: {
                    title: "Time"
                },
                yaxis: {
                    title: "Cumulative Hazard"
                }
            }
        );
    }
});

appMixture.BaseView = Backbone.View.extend({
    el: 'body',
    events: {
        'click #run': 'onSubmit'
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