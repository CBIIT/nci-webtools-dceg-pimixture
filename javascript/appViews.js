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
            'change:design': this.showNext,
            'change:model': this.showNext,
            'change:outcomeC': this.showNext,
            'change:outcomeL': this.showNext,
            'change:outcomeR': this.showNext,
            'change:covariates': this.showNext,
            'change:groupTrigger': this.resetGroup,
            'change:email': this.showNext
        }, this);
        this.$el.find('[name="covariates"]').selectize({
            plugins: ['remove_button'],
            sortField: 'order'
        });
        this.groupIndex = {};
        var lastGroup = null;
        this.$el.find('fieldset').each(function (index,e) {
            var group = {
                    'head': e,
                    'subs': []
                },
                skipNext = false,
                subs = group.subs;
            if (lastGroup !== null) {
                lastGroup.next = group;
            }
            $(e).find('select,input').each(function(index2,e2) {
                var lastIndex = subs.length;
                if (skipNext) {
                    skipNext = false;
                    return;
                }
                if (e2.selectize) {
                    skipNext = true;
                    subs.push({
                        'element': e2,
                        'name': e2.name,
                        'type': 'selectize'
                    });
                } else if (e2.tagName == 'SELECT') {
                    subs.push({
                        'element': e2,
                        'name': e2.name,
                        'type': 'select'
                    });
                } else {
                    subs.push({
                        'element': e2,
                        'name': e2.name,
                        'type': e2.type
                    });
                }
                subs[lastIndex].empty = $that.model.defaults[subs[lastIndex].name];
                $that.groupIndex[e2.name] = group;
            });
            lastGroup = group;
        });
    },
    events: {
        'change input[type="file"]': 'uploadFile',
        'change input.selectized': 'updateModel',
        'keyup input[type="text"]': 'updateModel',
        'change select': 'updateModel',
        'click #dataGroups': 'openDataGroups'
    },
    openDataGroups: function(e) {
        e.preventDefault();
        new appMixture.DataGroupsView({
            model: this.model
        });
    },
    updateModel: function(e) {
        e.preventDefault();
        var e = $(e.target),
            name = e.prop('name'),
            val = e.val();
        if (val === "null") val = null;
        if (!Number.isNaN(parseInt(val))) val = parseInt(val);
        this.model.set(name,val);
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
    resetGroup: function() {
        this.model.set('groupValue',[]);
        this.showNext.apply(this);
    },
    showNext: function() {
        var $that = this,
            attrs = this.model.changedAttributes();
        for (var key in attrs) {
            var group = $that.groupIndex[key],
                show = true;
            if (group && group.next) {
                for (var index in group.subs) {
                    var sub = group.subs[index];
                    if ($that.model.get(sub.name) === sub.empty) show = false;
                }
                $(group.next.head).toggleClass('show',show);
                if (!show) {
                    group = group.next;
                    for (var index in group.subs) {
                        var sub = group.subs[index];
                        switch (sub.type) {
                            case 'selectize':
                                sub.element.selectize.clear();
                                break;
                            case 'select':
                                $(sub.element).prop('selectedIndex',0);
                                $that.model.set(sub.name,sub.empty);
                                break;
                            case 'button':
                                break;
                            default:
                                $(sub.element).val(sub.empty);
                                $that.model.set(sub.name,sub.empty);
                                break;
                        }
                    }
                }
            }
        }
    },
    updateOptions: function() {
        this.showNext.apply(this);
        var contents = this.model.get('csvFile'),
            optionsList = "<option value=\"\">----Select Outcome----</option>",
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
    }
});

appMixture.DataGroupsView = Backbone.View.extend({
    initialize: function() {
        var headers = this.model.get('covariates');
        this.model.on({
            'change:groupValue': this.renderTable
        }, this)
        this.render();
    },
    events: {
        'hidden.bs.modal': 'remove',
        'keyup input[type="text"]': 'updateModel',
        'click .remove': 'removeEntry',
        'click .add': 'addEntry'
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
        var $that = this;
        this.model.on({
            'change': this.render
        }, this);
        $.get('templates/results.html').done(function(response) {
            $that.template = _.template(response);
        });
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