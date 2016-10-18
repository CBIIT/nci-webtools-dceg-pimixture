var appMixture = {
    models: {},
    views: {}
};

appMixture.FormView = Backbone.View.extend({
    el: '#input',
    initialize: function() {
        this.model.on({
            'change:csvFile': this.updateOptions,
            'change:design': this.showNext,
            'change:model': this.showNext
        }, this);
        this.$el.find('[name="covariates"]').selectize({
            plugins: ['remove_button'],
            sortField: 'order'
        });
    },
    events: {
        'change input[type="file"]': 'uploadFile',
        'change select': 'updateModel'
    },
    showNext: function() {
        var $that = this;
        var changedAttributes = Object.keys(this.model.changedAttributes());
        if (changedAttributes.length == 1) {
            var name = '[name="'+changedAttributes[0]+'"]';
            var field = this.$el.find(name).closest('fieldset');
            if ((this.model.get(changedAttributes[0])||"") === "") {
                var fieldsets = field.nextAll('fieldset').removeClass('show');
                fieldsets.find('select').prop('selectedIndex',0).each(function(index,e) {
                    $that.model.set(e.name,"",{'silent':true});
                });
                fieldsets.find('[name="covariates"]')[0].selectize.clear();
            } else {
                field.next('fieldset').addClass('show');
            }
        } else {
            this.$el.find('fieldset:not(:first-child)').removeClass('show');
        }
    },
    uploadFile: function(e) {
        var $that = this;
        if (window.FileReader) {                 
            var file = e.target.files[0];
            var reader = new window.FileReader();
            reader.onload = function (event) {
                //var contents = event.target.result;
                var contents = ["show","me","this"];
                contents = contents.map(function(e) {
                    return {'text':e,'value':e};
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
        var e = $(e.target),
            name = e.prop('name'),
            val = e.val();
        console.log(name);
        this.model.set(name,val);
    },
    updateOptions: function() {
        this.showNext.apply(this);
        var options = this.model.get('csvFile'),
            optionsList = "<option value=\"\">----Select Outcome----</option>",
            covariates = $('[name="covariates"]')[0].selectize;
        if (options === null) return;
        for (var index = 0; index < options.length; index++) {
            optionsList += "<option>"+options[index]+"</option>";
        }
        this.$el.find('[name="outcomeC"]').html(optionsList);
        this.$el.find('[name="outcomeL"]').html(optionsList);
        this.$el.find('[name="outcomeR"]').html(optionsList);
        covariates.clearOptions();
        covariates.addOption(options);
    }
});

$(function () {
        appMixture.models.form = new appMixture.FormModel();
        appMixture.views.form = new appMixture.FormView({
            model: appMixture.models.form
        });
});