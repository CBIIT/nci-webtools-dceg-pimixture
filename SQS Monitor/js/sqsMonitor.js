function queryStatus() {
    const product = $('#product').val();
    $.ajax({url: 'queryStatus',
            data: {product: product}
    }).done(function(results){
        console.log(results);
        for (const queue of results) {
            const row = $(`#${queue.tier}-row`);
            row.children('.queue-name').html(queue.queue_name);
            row.children('.enqueued-messages').html(queue.avl);
            row.children('.inflight-messages').html(queue.inflt);
        }
    });
}

$(window).on('load', function(){
    $('#product').change(function(e){
        const product = $(e.target).val();
        console.log(product);
        queryStatus();
    });

    $('#refresh').click(function(e){
        e.preventDefault();
        queryStatus();
    });

    queryStatus();
});