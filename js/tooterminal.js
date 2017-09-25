/*****************************
 * 設定
 *****************************/

let def_conf = {
    application: {
        name: 'Tooterminal',
        website: 'https://github.com/wd-shiroma/tooterminal/blob/gh-pages/README.md',
        uris: 'urn:ietf:wg:oauth:2.0:oob',
        scopes: {
            read:   true,
            write:  true,
            follow: true
        }
    },
    terminal: {
        length: 0
    },
    instances: {
        terminal: {
            logging: {
                favourite: true,
                reblog: true,
                mention: true,
                following: true
            },
            monitor: 'local'
        },
        status: {},
    }
}

let config;
let ins;
let url_params;
let acls;

let term_mode;
let mode_global;
let mode_configuration;
let mode_instance;
let instance_name;
let beep_buf;

let context = new AudioContext();


/*****************************
 * 本処理
 *****************************/

let enterCommand = (command, term) => {
    command = command.trim();
    term.resize(window.innerWidth - 36, window.innerHeight - 36);

    if (command.length === 0) {
        return;
    }

    let result = term_mode.execute(command, term);
    if (result !== true) {
        term.error(term_mode.result.message);
    }
    return;

};

let completion = (line, callback) => {
    let cmd_list = term_mode.getCompletion(line);
    if (cmd_list.length === 1) {
        $.terminal.active().set_command(term_mode.completion);
    }
    else {
        callback(cmd_list);
    }
};

let initConfig = (term) => {
    let store = localStorage;
    let st_conf = store.getItem('configuration');
    /*
    if (st_conf) {
        config = new ConfigManager(JSON.parse(str);
    }
    else {
        console.log('Initialization: read default config')
        config = def_conf;
    }*/

    config = new ConfigManager(def_conf, st_conf ? JSON.parse(st_conf) : {});
    url_params = {};

    if (!location.search.match(/^\?.+=.+/)) {
        return;
    }
    let params_org = location.search.replace(/^\?/, '').split(/[=&]/);
    for (let i = 0; i < params_org.length; i += 2) {
        url_params[params_org[i]] = params_org[i+1];
    }
    if (url_params.hasOwnProperty('code') && ins.name(url_params.instance_name)) {
        ins.get().auth_code = url_params.code;
        term.exec('instance ' + ins.name());
        history.replaceState('', '', location.pathname);
    }
    else if (url_params.hasOwnProperty('instance') && ins.name(url_params.instance)) {
        term.exec('instance ' + ins.name());
    }
};

let filterKey = (event, term) => {
    if(event.charCode === 63){
        let info = term_mode.information(term.get_command());

        let lines = info.map((cmd) => {
            return (typeof cmd.command === 'undefined')
                ? cmd : ('  ' + tab(cmd.command, cmd.description, 22));
        });
        lines.unshift(term.get_prompt() + term.get_command() + '?');
        lines.push('');
        more(term, lines, true);
        let cmd = term.get_command();
        term.set_command('');
        setTimeout(() => {
            term.set_command(cmd);
        },10);
    }
};

let parseCommand = (command, term) => {
    term_mode.parse(command.replace(/\?$/, ''));
};

let init_instance = function(term) {
    term_mode = mode_instance;
    let _ins = ins.get();

    let auto_term;
    if (config.find(['instances', 'terminal', 'auto'])){
        auto_term = config.find(['instances', 'terminal', 'monitor']);
        auto_term = auto_term.match(/(home|local|public|notification)/g);
    }
    if (url_params.hasOwnProperty('terminal')) {
        auto_term = url_params.terminal.match(/(home|local|public|notification)/g);

    }
    auto_term = (auto_term ? auto_term : []);
    if (auto_term.length > 0 && _ins.hasOwnProperty('access_token')) {
        if (typeof auto_term === 'string') {
            auto_term = [auto_term];
        }
        for (let i = 0; i < auto_term.length; i++) {
            ws.monitor[auto_term[i]] = true;
        }
        ws.startup = auto_term[0];
        term.exec('terminal monitor');
    }
    return;
    let src_url = 'https://' + _ins.domain + '/sounds/boop.ogg';
    let req = new XMLHttpRequest();
    req.responseType = 'arraybuffer';
    req.onreadystatechange = function() {
        if (req.readyState === 4) {
            if (req.status === 0 || req.status === 200) {
                if (req.response) {
                    context.decodeAudioData(req.response, function(buffer) {
                        beep_buf = buffer;
                    });
                }
                else {
                    $.terminal.active().error('Error: ポコポコできません');
                    console.log('error');
                    beep_buf = undefined;
                }
            }
        }
    };
    req.open('GET', src_url, true);
    req.send('')
};

let exit_instance = function() {
    term_mode = mode_global;
    closeTootbox();
    ins.name('');
}

let count_toot_size = () => {
    let msg_size = 500 - $('#toot_box').val().length - $('#toot_cw').val().length;
    $('#toot_size').css('color', msg_size < 0 ? '#F00' : '#bbb').text(msg_size);
}

function upload_img(imageFile) {
    let formData = new FormData();
    let _ins = ins.get();
    let len = $('.toot_media img').length;
    $('#toot_media').append($('<img />').attr('id', 'media_' + len)).slideDown('first');
    formData.append('file', imageFile);
    $.ajax('https://' + _ins.domain + '/api/v1/media' , {
        type: 'POST',
        contentType: false,
        processData: false,
        headers: {
            Authorization: _ins.token_type + ' ' + _ins.access_token
        },
        data: formData
    }).then((data, status, jqxhr) => {
        $('#media_' + len)
            .attr('data-id', data.id)
            .attr('data-url', data.text_url);
        let img = new Image();
        img.onload = () => {
            $('#media_' + len).attr('src', data.preview_url);
            $('#toot_box').val($('#toot_box').val() + ' ' + data.text_url);
            autosize.update($('#toot_box'));
            count_toot_size();
        };
        img.onerror = (e) => {
            console.log(e);
        };
        img.src = data.preview_url;
    }, (jqxhr, status, error) => {
        $.terminal.active().error('Media upload error.(' + jqxhr.status + ')');
        $('#media_' + len).remove();
        console.log(jqxhr);
    });
}

let tl;
$(function() {
    mode_global        = new ModeManager(new GlobalModeElement);
    mode_configuration = new ModeManager(new ConfigurationModeElement);
    mode_instance      = new ModeManager(new InstanceModeElement);
    ins = new InstanceManager();
    term_mode          = mode_global;
    tl = $('#timeline').terminal(enterCommand, {
        name:        'global',
        greetings:   "=== CLI画面風 マストドンクライアント \"Tooterminal\" ===\n\n使い方は\"help\"コマンドまたは\"?\"キーを押してください。\n\n",
        login:        false,
        onInit:       initConfig,
        prompt:       'Tooterminal# ',
        completion:   completion,
        height:       window.innerHeight - 18,
        onResize:     (term) => { term.resize($(window).width() - 36, $(window).height() - 36); },
        exit:         false,
        clear:        false,
        scrollOnEcho: false,
        keypress:     filterKey,
        onFocus:      (term) => { return false; },
        onResume:     false,
        onCommandChange: parseCommand,
    });
    $('#toot').on('keydown', (event) => {
        if (event.keyCode === 27) {
            closeTootbox();
        }
        else if(event.keyCode === 13 && event.ctrlKey) {
            post_status();
        }/*
        else if ($('#toot_box').val().match(/^@[0-9a-zA-Z_]+/) && $('.reply #sid').text() === '') {
            $('#toot_visibility').val('unlisted');
        }*/
    })
    .on('paste', (elem) => {

        if ($('.toot_media img').length >= 4) {
            return;
        }

        if (typeof elem.originalEvent.clipboardData !== 'undefined'
            && typeof elem.originalEvent.clipboardData.types !== 'undefined'
            && elem.originalEvent.clipboardData.types.length === 1
            && elem.originalEvent.clipboardData.types[0] === "Files"
        ) {
            let imageFile = elem.originalEvent.clipboardData.items[0].getAsFile();
            upload_img(imageFile);
        }
    });
    $('#toot_box').on('dragenter', (e) => {
        e.preventDefault();
        $('#toot_box').addClass('toot_imghover');

    })
    .on('dragover', (e) => {
    })
    .on('dragleave', (e) => {
        $('#toot_box').removeClass('toot_imghover');
    })
    .on('drop', (e) => {
        e.preventDefault();
        $('#toot_box').removeClass('toot_imghover');
        let files = e.originalEvent.dataTransfer.files;
        let f_max = 4 - $('#toot_media img').length;
        let f_uploadable = f_max < files.length ? f_max : files.length;
        for (let i = 0; i < f_uploadable; i++) {
            if (!files[i].type.match(/^(video|image)\//)) {
                continue;
            }
            upload_img(files[i]);
        }
    });
    $('#toot_cw').on('keyup', count_toot_size);
    $('#toot_box').on('keyup', count_toot_size);
    $('#toot_post').on('click', () => {
        post_status();
    });
    $('#help_close').on('click', () => {
        $('#help').slideUp('first');
        $.terminal.active().focus();
    });
    $('#reply_close').on('click', (e) => {
        $('#sid').text('');
        $('#reply').hide();
        $('#toot_box').val($('#toot_box').val().replace(/^@[a-zA-Z0-9_]+(?:@(?:[A-Za-z0-9][A-Za-z0-9\-]{0,61}[A-Za-z0-9]?\.)+[A-Za-z0-9]+)?\s+/, ''));
    });
    $('.img_background').on('click', function(){
        $('#img_view').fadeOut('first');
        $('#pre_view').fadeOut('first');
        $('#video_view').fadeOut('first');
        $('.img_background').fadeOut('first');
        $.terminal.active().enable();
    });
    $(document)
    .on('click', '.read_more', function() {
        $(this).next().toggle('fast');
    })
    .on('click', '.a_acct', function(e) {
        if (term_mode !== mode_instance) {
            return;
        }

        let acct = $(this).text().match(/((?:@?([a-zA-Z0-9_]+)@((?:[A-Za-z0-9][A-Za-z0-9\-]{0,61}[A-Za-z0-9]?\.)+[A-Za-z0-9]+))|(?:@([a-zA-Z0-9_]+)))/);
        callAPI('/api/v1/accounts/search', {
            data: {
                q: acct[0],
                limit: 1
            }
        })
        .then((data, status, jqxhr) => {
            $.terminal.active().exec('show user id ' + data[0].id)
            .done(() => {
                $.terminal.active().exec('show user id ' + data[0].id + ' statuses limit 3');
            })
        })
    })
    .on('mouseover', '.status', function() {
        let cfg = config.find('instances.status.thumbnail');
        if (typeof cfg === 'undefined'){
            $(this).find('.status_thumbnail').show();
        }
    })
    .on('mouseout', '.status', function() {
        let cfg = config.find('instances.status.thumbnail');
        if (typeof cfg === 'undefined'){
            $(this).find('.status_thumbnail').hide();
        }
    })
    .on('click', '.status', function(e) {
        if ($(this).hasClass('status_deleted')) {
            return;
        }
        let id = $(this).data('sid');
        if (e.shiftKey) {
            let reply = '@' + $(this).data('acct').toString();
            let re = /((?:@([a-zA-Z0-9_]+)@((?:[A-Za-z0-9][A-Za-z0-9\-]{0,61}[A-Za-z0-9]?\.)+[A-Za-z]+))|(?:@([a-zA-Z0-9_]+)))/g;
            let mul_reply = $(this).find('.status_contents')[0].textContent.replace(new RegExp(reply, 'g'), '').match(re);

            $.terminal.active().disable();
            $('#toot').slideDown('first');
            $('#reply').show();
            $('#sid').text($(this).data('sid'));
            $('#reply_head').text('reply to: ' + $(this).data('dispname'));
            $('#reply_body').text($(this).find('#status_contents')[0].textContent);
            $('#toot_box').focus().val('@' + $(this).data('acct') + ' ' + $(this).data('reply'));
            if ($($(this).find('.status_head i')[2]).hasClass('fa-envelope')) {
                $('#toot_visibility').val('direct');
            }
        }

        if (e.ctrlKey) {
            favorite(this);
        }
        if (e.altKey) {
            boost(this);
        }
    })
    .on('dblclick', '.status', function(e){
        $.terminal.active().exec('show status id ' + $(this).data('sid'));
    })
    .on('click', '.status_contents img', function(e) {
        let elem = $(this);

        $('#pre_view').attr('src', elem.attr('src')).fadeIn('first');

        if (elem.data('type') === 'gifv') {
            let video = $('#video_view')[0];
            video.src = elem.data('url');
            video.loop = true;
            video.autoplay = true;
            video.muted = true;
            video.controls = true;
            video.oncanplay = () => {
                $('#pre_view').fadeOut('first');
            };
            $('#video_view').fadeIn('first');
            $('.img_background').fadeIn('first');
        }
        else {
            let img = new Image();
            img.onload = () => {
                $('#img_view').attr('src', elem.data('url'));
            };
            img.onerror = (e) => {
                console.log(e);
            };
            $('.img_background').fadeIn('first');
            $.terminal.active().disable();
            img.src = elem.data('url');
        }
    })
    .on('click', '[name=cmd_followers]', (e) => {
        $.terminal.active().exec('show user id ' + $(e.target).data('uid') + ' followers');
    })
    .on('click', '[name=cmd_following]', (e) => {
        $.terminal.active().exec('show user id ' + $(e.target).data('uid') + ' following');
    })
    .on('click', '[name=cmd_status_pinned]', (e) => {
        $.terminal.active().exec('show user id ' + $(e.target).data('uid') + ' statuses pinned');
    })
    .on('keydown', '.img_background', (event) => {
        if (event.keyCode === 27) {
            $('.img_background').trigger('click');
        }
    })
    .on('click', '.status_enquete span', function(e) {
        let enquete = $(e.target).parent();
        let index = $(e.target).children().index(e.target);
        let status = enquete.parents('.status');
        let time_limit = Date.now() - Date.parse($(enquete).data('created'));
        let term = $.terminal.active();

        if (time_limit > 30000) {
            term.error('The vote has expired.');
            return;
        }

        let api = '/api/v1/votes/' + $(status).data('sid');
        callAPI(api, {
            type: 'POST',
            data: { item_index: index }
        })
        .then((data, status, jqxhr) => {
            if (data.valid) {
                term.echo('Vote: ' + $(e.target).text());
            }
            else {
                term.error(data.message);
            }
        }, (jqxhr, status, error) => {
            console.log(jqxhr);
        });

    })
    .on('click', '.toot_media img', (e,e2,e3) => {
        $(e.target).remove();
        $('#toot_box').val($('#toot_box').val().replace($(e.target).data('url'),''));
        if ($('#toot_media img').length === 0) {
            $('#toot_media').slideUp('first');
        }
    })
    .on('keydown', (e) => {
        if (e.keyCode === 65 && e.altKey && term_mode === mode_instance && $('#toot').css('display') === 'none') {
            $.terminal.active().exec('toot');
        }
    });
    window.onerror = function(msg, url, line, col, error) {
        console.log([msg,url,line,col,error]); // エラーの内容
    };
    autosize($('#toot_box'));
});

/*****************************
 * その他処理
 *****************************/

/*
function getConfig(config, index, d_conf) {
    let idxs = index.split('.');
    let cf = config;
    for (let i = 0; i < idxs.length; i++) {
        if (typeof cf[idxs[i]] !== 'undefined') {
            cf = cf[idxs[i]];
        }
        else {
            cf = undefined;
            break;
        }
    }
    if (typeof cf !== 'undefined') {
        return cf;
    }

    cf = (typeof d_conf !== 'undefined' ? d_conf : def_conf);
    for (let i = 0; i < idxs.length; i++) {
        cf = cf[idxs[i]];
        if (typeof cf === 'undefined') {
            break;
        }
    }
    return cf;
}*/

function makeStatus(payload, optional) {
    let date = new Date(payload.created_at);
    let is_reblog = (typeof payload.reblog !== 'undefined' && payload.reblog !== null);
    let is_mention = (payload.type === 'mention');
    let contents = is_reblog  ? payload.reblog
                 : is_mention ? payload.status
                 : payload;

    if (typeof optional !== 'object') {
        optional = {};
    }
    let ins_name = (typeof optional.ins_name === 'undefined') ? ins.name() : optional.ins_name;

    let _ins = ins.get(optional.ins_name);

    let app;
    if (contents.application === null) {
        app = '';
    }
    else if(!contents.application.website) {
        app = ' via ' + contents.application.name;
    }
    else{
        app = $('<a />')
            .text(contents.application.name)
            .attr('href', contents.application.website)
            .attr('target', '_blank')
            .prop('outerHTML');
        app = ' via ' + app;
    }

    let head = (is_reblog ? $.terminal.format("[[!i;;]reblogged by " + payload.account.display_name + ' @' + payload.account.acct + ']') + "<br />" : '') + '[ '
        + (typeof contents.account.display_name === 'undefined' ? '' : contents.account.display_name)
        + ' ' + $.terminal.format('[[!;;]@' + contents.account.acct + ']') + ' '
        + $('<i />').addClass('fa fa-' + (contents.favourited ? 'star' : 'star-o')).attr('aria-hidden', 'true').prop('outerHTML') + ' '
        + $('<i />').addClass('fa fa-' + (contents.visibility === 'direct' ? 'times-circle-o'
                        : contents.reblogged ? 'check-circle-o' : 'retweet'))
                .attr('aria-hidden', 'true').prop('outerHTML') + ' '
        + $('<i />').addClass('fa fa-' + (
                    contents.visibility === 'public'   ? 'globe'
                  : contents.visibility === 'unlisted' ? 'unlock'
                  : contents.visibility === 'private'  ? 'lock'
                  : contents.visibility === 'direct'   ? 'envelope'
                  : 'question'))
            .attr('aria-hidden', 'true').prop('outerHTML')
        + (contents.in_reply_to_id ? ' ' + $($('<i />').addClass('fa fa-mail-reply'))
                  .attr('aria-hidden', 'true').prop('outerHTML') + ' ' : '')
        + ' ' + date.getFullYear() + '-' + ('0' + (date.getMonth()+1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2)
        + ' ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2) + ':'
        + ('0' + date.getSeconds()).slice(-2) + '.' + ('00' + date.getMilliseconds()).slice(-3) + ' ]' + app;

    let reply = '';
    if (contents.mentions.length > 0) {
        for (let i = 0; i < contents.mentions.length; i++) {
            reply += '@' + contents.mentions[i].acct + ' ';
        }
        reply = reply.replace('@' + _ins.user.acct + ' ', '');
    }

    let avatar = $('<td />').addClass('status_avatar');
    let cfg = config.find('instances.status.avatar');
    if (typeof cfg !== 'undefined') {
        let url = contents.account.avatar_static;
        avatar.append($('<img />')
            .attr('name', 'img_' + contents.account.id)
            .attr('src', url));
        if (!url.match(/^http/)) {
            url = 'https://' + _ins.domain + url;
        }

        let img = new Image();
        img.onload = () => {
            $('[name=img_' + contents.account.id + ']').attr('src', url);
        };
        img.onerror = (e) => {
            console.log(e);
        };
        img.src = url;
    }
    else {
        avatar.hide();
    }

    let content;
    let enquete;

    if (typeof contents.enquete !== 'undefined' && contents.enquete !== null) {
        enquete = JSON.parse(contents.enquete);
        question = enquete.question.replace(
                /^(?:<p>)?(.*?)(?:<\/p>)?$/g, '<p><span>$1' +
                (enquete.type === 'enquete' ? '(回答枠)' : '(結果)')
                + '</span></p>')
        content = $('<div />').append(question);
        let enquete_items = $('<div />')
                .addClass('status_' + enquete.type)
                .attr('data-created', contents.created_at);
        for (let i = 0; i < enquete.items.length; i++) {
            if (enquete.type === 'enquete') {
                enquete_items.append($('<span />')
                    .html(enquete.items[i]));
            }
            else {
                enquete_items
                    .append($('<span />')
                        .append($('<span />')
                            .addClass('progress ratio')
                            .text(enquete.ratios[i] + '%'))
                        .append($('<span />')
                            .addClass('progress item')
                            .text(enquete.items[i]))
                        .append($('<span />')
                            .addClass('proceed')
                            .css('width', enquete.ratios[i].toString() + '%')))
            }
        }
        content.append(enquete_items);
    }
    else {
        content = contents.content;
        if (content.match(/^<.+>$/)) {
            content = content.replace(/<p>(.*?)<\/p>/g, '<p><span>$1</span></p>')
        }
    }

    let thumb;
    if (contents.media_attachments.length > 0) {
        thumb = $('<div />').addClass('status_thumbnail');
        contents.media_attachments.forEach((media, index, arr) => {
            let preview_url = (!media.preview_url.match(/^https?:\/\//)
                    ? 'https://' + _ins.domain + media.preview_url
                    : media.preview_url);
            let url = media.remote_url ? media.remote_url : media.url;
            let id = 'media_' + media.id;
            thumb.append($('<img />')
                .attr('id', id)
                .attr('src', preview_url)
                .attr('data-url', url)
                .attr('data-type', media.type));
            let img = new Image();
            img.onload = () => {
                $('#' + id).attr('src', preview_url);
            };
            img.onerror = (e) => {
                console.log(e);
            };
            img.src = preview_url;
        });
        let cfg = config.find('instances.status.thumbnail');
        if (typeof cfg === 'undefined') {
            thumb.hide();
        }
    }

    let content_visible = $('<div />')
        .addClass('status_contents')
        .attr('id', 'status_contents');
    let content_more;

    if (contents.sensitive) {
        content_more = $('<div />');
        if (contents.spoiler_text.length > 0) {
            content_visible.append($.terminal.format(contents.spoiler_text));
            content_more.append(content);
        }
        else {
            content_visible.append(content);
        }

        if(typeof thumb !== 'undefined') {
            content_more.append(thumb);
        }
    }
    else {
        if (contents.spoiler_text.length > 0) {
            content_visible.append($.terminal.format(contents.spoiler_text));
            content_more = $('<div />');
            content_more.append(content);
        }
        else {
            content_visible.append(content);
        }
        if (typeof thumb !== 'undefined') {
            content_visible.append(thumb);
        }
    }

    if (typeof content_more !== 'undefined') {
        content_visible
            .append($('<div />')
                .addClass('read_more')
                .append($.terminal.format('[[bu;black;gray]-- More --]')))
            .append(content_more.hide());
    }

    let main = $('<td />')
        .addClass('status_main')
            .append($('<div />').addClass('status_head').html($.terminal.format(head)))
            .append(content_visible);

    let status = $('<table />')
        .attr('name', 'id_' + contents.id)
        .attr('data-sid', contents.id)
        .attr('data-instance', ins_name)
        .attr('data-uid', contents.account.id)
        .attr('data-dispname', contents.account.display_name)
        .attr('data-acct', contents.account.acct)
        .attr('data-fav', contents.favorited ? '1' : '0')
        .attr('data-reb', contents.reblogged ? '1' : '0')
        .attr('data-reply', reply)
        .addClass('status')
        .append($('<tr />')
            .append(avatar)
            .append(main));
    if (typeof optional.tl_name === 'string') {
        let name = 'stream_' + contents.id;
        if ($('[name=' + name + ']').length > 0) {
            return '';
        }
        let tl = $('<tr />')
            .attr('name', name)
            .append($('<td />')
                .html('>> ' + optional.tl_name + ' streaming updated.')
                .attr('colspan', '2'));
        status.prepend(tl);
    }
    if (ins.acls.hasOwnProperty(ins_name)) {
        for (let acl_num in ins.acls[ins_name]) {
            let acl = ins.acls[ins_name][acl_num];
            if (status.text().match(acl.regexp)) {
                if (acl.type === 'permit') {
                    status.addClass('status_' + acl.color);
                }
                else if(acl.type === 'deny') {
                    return '';
                }
                break;
            }
        }
    }
    if (config.find('instances.status.separator')) {
        status.append(
            '<tr><td colspan="2"><span>'
            + Array($.terminal.active().cols() - 5).join('-')
            + '</span></td></tr>'
        );
    }
    return status.prop('outerHTML');
}

function make_notification(payload, notifies) {
    let is_fav = (payload.type === 'favourite') && notifies.favourite;
    let is_reb = (payload.type === 'reblog') && notifies.reblog;
    let is_fol = (payload.type === 'follow') && notifies.following;
    let is_men = (payload.type === 'mention') && notifies.mention;

    let msg = '';
    if (is_fav || is_reb || is_fol || is_men) {
        let content = payload.status
                ? $.terminal.escape_brackets($(payload.status.content).text())
                : '(Status was deleted)';
        if (content.length > 100) {
            content = content.slice(0,100) + ' ...';
        }

        msg = 'Notification! : ' + payload.type
            + ' << ' + payload.account.display_name + ' '
            + $.terminal.format('[[!;;]@' + payload.account.acct + ']') + "<br />"
            + (payload.status ? content : '');
        msg = $('<span />').html(msg).addClass('status_notify').prop('outerHTML');
        if (payload.type === 'mention') {
            msg += makeStatus(payload);
        }
    }
    return msg;
}

function post_status() {
    let status = $('#toot_box').val().trim();
    let cw = $('#toot_cw').val().trim();
    let visibility = $('#toot_visibility').val();
    let data = {
        status: status,
        visibility: visibility
    };
    let _ins = ins.get();
    let msg_size = 500 - $('#toot_box').val().length - $('#toot_cw').val().length
    if (status.length === 0 || msg_size < 0) {
        return false;
    }
    else if(typeof _ins === 'undefined'
         && typeof _ins.access_token === 'undefined') {
        return false;
    }
    if (cw.length !== 0) {
        data.spoiler_text = cw;
    }

    let reply_id = $('.reply #sid').text();
    if (reply_id !== '') {
        data.in_reply_to_id = reply_id;
    }

    data.media_ids = [];
    let imgs = $('#toot_media img');
    for (let i = 0; i < imgs.length; i++) {
        data.media_ids.push($(imgs[i]).data('id'));
    }

    if (data.media_ids.length > 0) {
        data.sensitive = $('#nsfw').prop('checked');
    }

    return $.ajax({
        url: 'https://' + _ins.domain + '/api/v1/statuses',
        type: 'POST',
        headers: {
            Authorization: _ins.token_type + ' ' + _ins.access_token
        },
        data: data,
        timeout: 5000
    }).then((data, status, jqxhr) => {
        let visibility = config.find('instances.visibility');
        if (typeof visibility === 'undefined') {
            visibility = 'public';
        }
        $('#toot_cw').val('');
        $('#toot_visibility').val(visibility);
        $('#reply_close').trigger('click');
        $('#toot_media').html('');
        $('#toot_box').val('').trigger('keyup').focus();
        autosize.update($('#toot_box'));
    }, (jqxhr, status, error) => {
        $.terminal.active().error('Toot post error.(' + jqxhr.status + ')');
        console.log(jqxhr);
    });
}

function reduce_status() {
    let statuses = $('.status').parent().parent();
    let old_stats = statuses.length - 200;
    for (let i = 0; i < old_stats; i++) {
        $(statuses[i]).remove();
    }
}

function callAPI(path, opts = {}) {
    let def;
    let _ins = typeof opts.instance_name === 'undefined'
            ? ins.get() : ins.get(opts.instance_name);
    if (typeof path === 'undefined') {
        def = new $.Deferred;
        def.reject('Undefined path');
    }
    else if (typeof _ins === 'undefined') {
        def = new $.Deferred;
        def.reject('No instance');
    }
    else if (typeof _ins.access_token === 'undefined') {
        def = new $.Deferred;
        def.reject('No login');
    }
    else {
        def = $.ajax({
            url: 'https://' + _ins.domain + path,
            type: typeof opts.type !== 'undefined' ? opts.type : 'GET',
            headers: {
                Authorization: _ins.token_type + ' ' + _ins.access_token
            },
            data: typeof opts.data ? opts.data : '',
            dataType: 'json',
            timeout: 5000
        })
        .done((data, status, jqxhr) => {
            return jqxhr;
        })
        .fail((jqxhr, status, error) => {
            term_error('API Request Error', {
                path: path,
                opts: opts
            });
            return jqxhr;
        });
    }
    return def;
}

function favorite(status, term) {
    let isFav = ($(status).data('fav') == 1);
    let api = '/api/v1/statuses/'
            + $(status).data('sid').toString()
            + (isFav ? '/unfavourite' : '/favourite' );
    if (typeof term === 'undefined') {
        term = $.terminal.active();
    }

    $($(status).find('i')[1]).removeClass().addClass('fa fa-spinner fa-pulse');

    callAPI(api, {
        instance_name: $(status).data('instance'),
        type: 'POST'
    }).then((data, stat, jqxhr) => {
        $('[name=id_' + $(status).data('sid').toString() + ']').each((index, elem) => {
            $($(elem).find('i')[1])
                .removeClass()
                .addClass('fa fa-' + (data.favourited ? 'star' : 'star-o'))
            $(elem).data('fav', data.favourited ? '1' : '0');
        });
        if (isFav === data.favourited) {
            term.error('favourited missed...');
        }
    }, (jqxhr, stat, error) => {
        $.terminal.active().error('Favorite failed.(' + jqxhr.status + ')');
        $($(status).find('i')[1]).removeClass().addClass('fa fa-' + (isFav ? 'star' : 'star-o'));
        console.log(jqxhr);
    });
}

function closeTootbox() {
    $('#sid').text('');
    $('#reply').hide();
    $('#toot_box').val('');
    $('#toot').slideUp('first');
    $.terminal.active().enable();
}

function boost(status) {
    if ($($(status).find('i')[2]).hasClass('fa-times-circle-o')) {
        return;
    }
    let isReb = ($(status).data('reb') == 1);
    let api = '/api/v1/statuses/'
            + $(status).data('sid').toString()
            + (isReb ? '/unreblog' : '/reblog' );
    if (typeof term === 'undefined') {
        term = $.terminal.active();
    }

    $($(status).find('i')[2]).removeClass().addClass('fa fa-spinner fa-pulse');

    callAPI(api, {
        instance_name: $(status).data('instance'),
        type: 'POST'
    }).then((data, stat, jqxhr) => {
        $('[name=id_' + $(status).data('sid').toString() + ']').each((index, elem) => {
            $($(elem).find('i')[2])
                .removeClass()
                .addClass('fa fa-' + (data.reblogged ? 'check-circle-o' : 'retweet'))
            $(elem).data('reb', data.reblogged ? '1' : '0');
        });
        if (isReb === data.reblogged) {
            term.error('reblogged missed...');
        }
    }, (jqxhr, stat, error) => {
        $.terminal.active().error('Reblogged failed.(' + jqxhr.status + ')');
        $($(status).find('i')[2]).removeClass().addClass('fa fa-' + (isReb ? 'check-circle-o' : 'retweet'));
        console.log(jqxhr);
    });
}

function tab(arg1, arg2, indent){
    let arg1_escape = escape(arg1).replace(/%u[0-9a-f]{2,6}/ig, 'xx').replace(/%[0-9a-f]{2}/ig, 'x');
    let arg1_length = arg1_escape.length;

    let result = (indent <= arg1_length)
        ? arg1.substr(0, indent - 4) + '... ' : arg1;

    for(let i = arg1_length; i < indent; i++, result += ' ') {}
    return result + arg2;
}

String.prototype.addTab = function(arg1, indent){
    return tab(arg1, this, indent);
};

function term_error(msg, params) {
    let date = new Date();
    let _params;
    let s_config = localStorage.getItem('configuration');
    let errors = localStorage.getItem('term_error');
    errors = errors ? JSON.parse(errors) : [];

    s_config = s_config ? s_config : {};
    if (typeof params === 'object') {
        _params = JSON.parse(JSON.stringify(params));
    }
    else if (!params) {
        _params = {};
    }
    else {
        _params = params;
    }
    let info_text = JSON.stringify({
        running_config: config.config,
        startup_config: s_config,
        default_config: config.default,
        instances: ins.instances,
        status: {
            message: msg,
            created_at: date.getTime(),
        },
        params: _params
    });
    errors.push(JSON.parse(info_text));
    if (errors.length > 5) {
        errors.shift();
    }
    localStorage.setItem('term_error', JSON.stringify(errors));
}

function OutputText(text, fileName) {
    let b = new Blob(["\uFEFF", text]);
    if (navigator.msSaveBlob) {
        navigator.msSaveOrOpenBlob(b, fileName);
    } else {
        let a = $('<a />')
            .attr('href', URL.createObjectURL(b))
            .attr('download', fileName)
            .attr('target', '_blank')
        $('body').append(a);
        a[0].click();
        a.remove();
    }
}

function more(term, lines, reverse){
    let rows = term.rows();
    let command = term.get_command();
    let i = 0;
    term.push(function(command,term){},{
        name: 'more',
        //prompt: '[[;#111111;#DDDDDD]-- More --]',
        prompt: '--More-- ',
        onStart: function(moreterm){
            moreterm.echo(lines.slice(i, i + rows).join("\n"));
            i += rows;
            if(i > lines.length){
                moreterm.pop();
                if(reverse) moreterm.set_command(command);
            }
            moreterm.resume();
        },
        keydown: function(event, moreterm){
            switch(event.keyCode){
                case 81:
                    moreterm.pop();
                    if(reverse) moreterm.set_command(command);
                    break;
                case 13:
                    moreterm.echo(lines.slice(i, i + 1).join("\n"));
                    i++;
                    if(i > lines.length){
                        moreterm.pop();
                        if(reverse) moreterm.set_command(command);
                    }
                    break
                default:
                    moreterm.echo(lines.slice(i, i + rows).join("\n"));
                    i += rows;
                    if(i > lines.length){
                        moreterm.pop();
                        if(reverse) moreterm.set_command(command);
                    }
                    moreterm.set_command("");
                    break;
            }
            return false;
        }
    });
}
function begin(term, lines, reverse, search){
    let i = 0;
    //console.log(search);
    //var re = new RegExp('\\s*' + search.name + '\\s+', '');
    //var keyword = search.command.replace(re, '');
    //console.log("//" + keyword + "/s/");
    for(i = 0; i < lines.length; i++){
        if(lines[i].match(search)){
            break;
        }
    }
    //console.log(["begin",result]);
    more(term, lines.slice(i), reverse, search);
}

function include(term, lines, reverse, search){
    let result = [];
    for(let i = 0; i < lines.length; i++){
        if(lines[i].match(search)){
            result.push(lines[i]);
        }
    }
    more(term, result, reverse);
}
function exclude(term, lines, reverse, search){
    let result = [];
    for(let i = 0; i < lines.length; i++){
        if(!lines[i].match(search)){
            result.push(lines[i]);
        }
    }
    more(term, result, reverse);
}
