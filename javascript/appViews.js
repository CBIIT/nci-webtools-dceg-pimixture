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
    initialize: function() {
        var $that = this;
        this.model.on({
            'change:csvFile': this.updateOptions,
            'change:design': this.changeDesign,
            'change:model': this.changeModel,
            'change:outcomeC': this.changeCovariates,
            'change:outcomeL': this.changeCovariates,
            'change:outcomeR': this.changeCovariates,
            'change:covariates': this.changeCovariateList,
            'change:email': this.changeEmail
        }, this);
        this.$el.find('[name="covariates"]').selectize({
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
        'click #referencesButton': 'openReferenceGroups'
    },
    openInteractiveEffects: function(e) {
        e.preventDefault();
        new appMixture.InteractiveEffectsView({
            model: new appMixture.EffectsModel({
                'formModel': this.model,
                'covariates': this.model.get('covariates'),
                'effects': this.model.get('effects').slice()
            })
        });
    },
    openReferenceGroups: function(e) {
        e.preventDefault();
        new appMixture.ReferenceGroupsView({
            model: this.model
        });
    },
    uploadFile: function(e) {
        e.preventDefault();
        var $that = this;
        if (window.FileReader) {                 
            var file = e.target.files[0];
            var reader = new window.FileReader();
            reader.onload = function (event) {
                var contents = event.target.result.replace('\r','').split('\n'),
                    headers = contents.shift().split(','),
                    file = [];
                contents = contents.map(function(e) {
                    var cols = e.split(','),
                        obj = {};
                    for (var index in cols) {
                        obj[headers[index]] = cols[index];
                    }
                    return obj;
                });
                $that.model.set('csvFile', contents);
            };
            if (file) {
                reader.readAsText(file);
            } else {
                $that.model.set('csvFile', null);
            }
        }
    },
    updateModel: function(e) {
        e.preventDefault();
        var e = $(e.target),
            name = e.prop('name'),
            val = e.val();
        switch (e.prop('type')) {
            case 'checkbox':
                val = e.prop('checked') || false;
                break;
            default:
                if (val === "null") val = null;
                if (!Number.isNaN(parseInt(val))) val = parseInt(val);
                break;
        }
        this.model.set(name,val);
    },
    changeCovariateList: function() {
        var model = this.model,
            covariates = this.model.get('covariates');
        if (covariates.length > 1) {
            model.set('effects',[]);
        } else {
            model.set('effects',model.get('effects').filter(function(entry) {
                return covariates.indexOf(entry.first) > -1 && covariates.indexOf(entry.second) > -1;
            }));
            model.set('references',model.get('references').filter(function(entry) {
                for (var index in entry) {
                    if (covariates.indexOf(entry[index]) < 0) {
                        return false;
                    }
                }
                return true;
            }));
        }
        this.changeCovariates.apply(this);
    },
    changeCovariates: function() {
        var model = this.model,
            covariates = model.get('covariates');
        if (model.get('outcomeC') === "" || model.get('outcomeL') === "" || model.get('outcomeR') === "" || covariates === "") {
            this.clearAfter('#covariatesSet');
        } else {
            if (covariates.split(',').length > 1) {
                this.showNext('#covariatesSet');
            } else {
                this.clearAfter('#covariatesSet');
            }
            this.showNext('#effectsSet');
            this.showNext('#referencesSet');
        }
    },
    changeDesign: function() {
        if (this.model.get('design') === "") {
            this.clearAfter('#designSet');
        } else {
            this.showNext('#designSet');
        }
    },
    changeEmail: function() {
        if (this.model.get('email') === "") {
            this.clearAfter('#emailSet');
        } else {
            this.showNext('#emailSet');
        }
    },
    changeModel: function() {
        if (this.model.get('model') === "") {
            this.clearAfter('#modelSet');
        } else {
            this.showNext('#modelSet');
        }
    },
    resetGroup: function() {
        this.model.set('groupValue',[]);
        this.showNext.apply(this);
    },
    updateOptions: function() {
        var contents = this.model.get('csvFile');
        if (contents) {
            this.showNext('#fileSet');
        } else {
            this.clearAfter('#fileSet');
            return;
        }
        var optionsList = "<option value=\"\">----Select Outcome----</option>",
            covariates = $('[name="covariates"]')[0].selectize;
        if (options === null) return;
        var options = Object.keys(contents[0]).map(function(e) { return {'text':e,'value':e.replace(/"/g,'&quot;')}; });
        for (var index = 0; index < options.length; index++) {
            optionsList += "<option value=\""+options[index].value+"\">"+options[index].text+"</option>";
        }
        this.$el.find('[name="outcomeC"]').html(optionsList);
        this.$el.find('[name="outcomeL"]').html(optionsList);
        this.$el.find('[name="outcomeR"]').html(optionsList);
        covariates.clearOptions();
        covariates.addOption(options);
    },
    clearAfter: function(id) {
        var next = $(id).next();
        next.find('input,select,.selectized').each(function(index,child) {
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
    showNext: function(id) {
        $(id).next().addClass('show');
    }
});

appMixture.InteractiveEffectsView = Backbone.View.extend({
    initialize: function() {
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
    addEffect: function(e) {
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
        model.trigger('change:effects',model);
    },
    close: function(e) {
        e.preventDefault(e);
        this.$modal.close();
    },
    removeEffect: function(e) {
        var e = $(e.target)
            model = this.model,
            effects = model.get('effects');
        effects.splice(e.prop('data-index'),1);
        model.trigger('change:effects',model);
    },
    save: function(e) {
        e.preventDefault(e);
        this.model.get('formModel').set('effects',this.model.get('effects'));
        this.close.call(this,e);
    },
    updateModel: appMixture.events.updateModel,
    render: function() {
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
    rerenderSelects: function() {
        var model = this.model,
            effects = model.get('effects'),
            first = model.get('first'),
            second = model.get('second'),
            firstList = model.get('covariates').split(',').filter(function(entry) { return entry !== second; }),
            secondList = model.get('covariates').split(',').filter(function(entry) { return entry !== first; }),
            eF = this.$el.find('[name="first"]'),
            eS = this.$el.find('[name="second"]'),
            selectedIndex = 0;
        eF.empty().append($('<option>',{
            text: "---Select Covariate---",
            value: ""
        }));
        firstList.forEach(function(entry,index) {
            if (entry === first) selectedIndex = index+1;
            eF.append($('<option>',{
                text: entry.replace(/&quot;/g,"\""),
                value: entry
            }));
        });
        eF[0].selectedIndex = selectedIndex;
        selectedIndex = 0;
        eS.empty().append($('<option>',{
            text: "---Select Covariate---",
            value: ""
        }));
        secondList.forEach(function(entry,index) {
            if (entry === second) selectedIndex = index+1;
            eS.append($('<option>',{
                text: entry.replace(/&quot;/g,"\""),
                value: entry
            }));
        });
        eS[0].selectedIndex = selectedIndex;
        first = this.model.get('first');
        second = this.model.get('second');
        var alreadyInserted = effects.length > 0 ? effects.filter(function(entry) {
            console.log(first < second ? first : second)
            return entry.first == (first < second ? first : second) && entry.second == (first < second ? second : first);
        }).length > 0 : false;
        if (first === '' || second === '' || alreadyInserted) {
            this.$el.find('.glyphicon-plus').attr('disabled',true);
        } else {
            this.$el.find('.glyphicon-plus').removeAttr('disabled');
        }
    },
    rerenderFooter: function() {
        this.$el.find('tfoot').empty().append(_.template(appMixture.templates.get('effectsFooter'))(this.model.attributes));
    }
});

appMixture.ReferenceGroupsView = Backbone.View.extend({
    initialize: function() {
        this.render();
    },
    events: {
        'hidden.bs.modal': 'remove'
    },
    addEntry: function(e) {
        var target = $(e.target),
            inputs = target.parent().parent().find('input'),
            covariates = this.model.get('covariates').split(','),
            groupValue = this.model.get('groupValue');
        var obj = {};
        for (var index in covariates) {
            var input = inputs.eq(index);
            obj[covariates[index]] = input.val();
            input.val('');
        }
        groupValue.push(obj);
        this.model.trigger('change:groupValue',this.model);
        this.model.set({
            'groupTrigger': 'something'
        });
    },
    removeEntry: function(e) {
        var index = $(e.target).prop('name'),
            groupValue = this.model.get('groupValue');
        groupValue.splice(index,1);
        this.model.trigger('change:groupValue',this.model);
        if (groupValue.length < 1) {
            this.model.set({
                'groupTrigger': ''
            });
        }
    },
    updateModel: function(e) {
        if (e.keyCode == 13) {
            this.createList.call(this,e);
        } else {
            appMixture.events.updateModel.call(this,e);
        }
    },
    render: function() {
        var covariates = this.model.get('covariates').split(',');
        this.$modal = BootstrapDialog.show({
            'message': $("<table><thead></thead><tbody></tbody><tfoot></tfoot></table>"),
            'title': "Enter Data Groups"
        });
        this.setElement(this.$modal.getModal());
        var tfoot = "<tr>";
        for (var index in covariates) {
            tfoot += "<td><input type=\"text\" placeholder=\""+covariates[index]+"\"/></td>";
        }
        tfoot += "<td class=\"borderless\"><button class=\"add disabled\">Add</button></td></tr>";
        this.$el.find('tfoot').empty().append(tfoot);
        this.renderTable.apply(this);
    },
    renderTable: function() {
        var covariates = this.model.get('covariates').split(','),
            groupValue = this.model.get('groupValue'),
            thead = "<tr>",
            tbody = "",
            tfoot = "<tr>";
        for (var index in covariates) {
            thead += "<th>"+covariates[index]+"</th>";
        }
        for (var index in groupValue) {
            tbody += "<tr>";
            for (var index2 in covariates) {
                tbody += "<td>"+groupValue[index][covariates[index2]]+"</td>"
            }
            tbody += "<td class=\"borderless\"><button name=\""+index+"\" class=\"remove\">X</button></td></tr>";
        }
        thead += "<th class=\"borderless\"></th></tr>";
        this.$el.find('thead').empty().append(thead);
        this.$el.find('tbody').empty().append(tbody);
    }
});

appMixture.ResultsView = Backbone.View.extend({
    el: '#output',
    initialize: function() {
        this.model.on({
            'change': this.render
        }, this);
        this.template = _.template(appMixture.templates.get('results'));
    },
    render: function() {
        this.$el.addClass('show');
        this.$el.html(this.template(this.model.attributes));
    }
});

appMixture.BaseView = Backbone.View.extend({
    el: 'body',
    events: {
        'click #run': 'onSubmit'
    },
    onSubmit: function(e) {
        e.preventDefault();
        var $that = this,
            params = JSON.stringify(this.model.get('form').attributes);
        this.model.get('results').fetch({
            type: "POST",
            data: params,
            dataType: "json"
        });
    }
});

$(function () {
        appMixture.templates = new appMixture.TemplatesModel();
        appMixture.templates.fetch().done(function() {
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