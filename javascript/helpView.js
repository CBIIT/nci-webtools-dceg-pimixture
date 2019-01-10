appMixture.HelpView = Backbone.View.extend({
    el: '#help-tool',
    initialize: function() {
        this.template = _.template(appMixture.templates.get('help'), {
            'variable': 'data'
        });
    },
    render: function() {
        this.$el.html(this.template())
    }
});