//あいう
// vim: set foldmethod=marker :
/**
 * linkcollection.js
 *
 * @dependency jQuery-1.7.2 <http://jquery.com/>
 * @licence    MIT Licence <http://www.opensource.org/licenses/mit-license.php>
 * @author     sorenariblog[at]google[dot]com <http://kjirou.sakura.ne.jp/mt/>
 * @charset    utf-8
 *
 * 残タスク:
 * - Chromeで@tagorderが設定してある場合に2次ソートであるデフォルトソートが崩れる
 * - カテゴリの概念、初期カテゴリ表示、カテゴリは明示指定かタグの先頭にするか？
 */
(function(){
var __classScope__ = this;


if ('LinkCollection' in __classScope__) {
    alert('linkcollection.js: `LinkCollection` is already defined');
    return;
};
if ('$' in __classScope__ === false) {
    alert('linkcollection.js: Not required jQuery as `$`');
    return;
};


/**
 * LinkCollection本体クラス
 */
var cls = function(){

    /**
     * リンクデータリスト
     *
     * [] = {
     *     url: '<URL,必須>',
     *     title: '<タイトル || null>',
     *     category: '<カテゴリ || null>',
     *     tags: '<タグリスト || null>',
     *     tagsText: '<タグリスト元テキスト || null>',
     *     comment: '<コメント || null>',
     *     view: <jQueryオブジェクト>,
     * }
     */
    this._data = [];

    /**
     * 設定データリスト
     *
     * オリジナルデータファイル上の書式:
     *   @設定名 引数1 引数2 ..
     *
     * [] = {
     *     settingName: <'taglabel' || 'tagorder'>,
     *     args: [<引数リスト>],
     * }
     */
    this._settingData = [];

    /** 元データ */
    this._source = undefined;
    /** 元データURL */
    this._sourceUrl = undefined;
    /** 元ータ元タイプ, 'original' || 'json'(未実装) || 'jsonp'(未実装) */
    this._sourceType = 'original';

    /** 枠ビュー */
    this._view = undefined;
    /** リンクリストビュー */
    this._linkListView = undefined;
    /** タグ選択ビュー枠 */
    this._tagSelectorView = undefined;

    /**
     * タグデータ
     *
     * '<タグキー>': {
     *     isSelected: <bool>,
     *     view: <jQueryオブジェクト>,
     *     label: <ラベル文字列 || null=キーを表示>,
     *     order: <タグ整列順 || 99999999=末尾>,
     * }
     */
    this._tagData = {};
};


/** 共通CSSセレクタ文字列 */
cls.CSS_SELECTOR = 'lc';


function __INITIALIZE(self){
    self._view = $('<div />').addClass(cls.CSS_SELECTOR);
    self._linkListView = $('<div />').addClass(cls.CSS_SELECTOR + '-linklist');
    self._tagSelectorView = $('<div />').addClass(cls.CSS_SELECTOR + '-tagselector');
    self._view.append(self._tagSelectorView).append(self._linkListView);
};

/** データを取得してビューを生成する
    options:
      complete: 完了時コールバック
*/
cls.prototype.build = function(options){
    var self = this;
    var opts = options || {};
    var complete = (opts.complete !== undefined)? opts.complete: function(){};

    this._requestSource(function(){
        try {
            self._parseSource();
            //! _setTagData は _createLinkViews より先
            //  タグラベル情報がリンクビュー生成時に必要なため
            self._setTagData();
            self._createLinkViews();
            self._initializeViews();
            self._draw();
            complete();
        } catch (err) {
            cls.consoleLog(err);
        };
    });
};

/** ビューを返す, 単なるアクセサ */
cls.prototype.getView = function(){ return this._view };

/** 外部からデータを取得する, complete func コールバック */
cls.prototype._requestSource = function(complete){
    var self = this;
    // リクエストしてデータを取得
    $.ajax({
        type: 'GET',
        url: self._sourceUrl,
        cache: false,
        dataType: 'text',
        //dataType: 'jsonp',
        //jsonp: '__jsonp__',
        success: function(data){
            self._source = data;
            complete();
        }
    });
};

/** 元データを解析してデータへ変換する */
cls.prototype._parseSource = function(){
    var self = this;

    // 改行文字を正規化
    var src = this._source.replace(/(?:\r\n|\r)/g, '\n');
    // コメント削除
    //   行頭判別は"先頭もしくは改行直後"というルーチンになっている
    src = src.replace(/(^|\n)#[^\n]*/g, '$1');
    // 頭と末尾の改行文字を除去
    src = src.replace(/(?:^\n+|\n+$)/g, '');
    // 最後に末尾に改行文字を付与, 空行が来るとデータを追加するため
    src += '\n';

    // 上からループ
    var dat = null; // 現在処理中のリンクデータ
    cls._each(src.split('\n'), function(nouse, line){

        // @で始まる行は設定データと解釈
        var settings;
        if (/^@/.test(line)) {
            settings = line.replace(/^@/, '').split(/ +/);
            self._settingData.push({
                settingName: settings[0],
                args: settings.slice(1)
            });
            return;
        };

        // 空行が来たら処理中データを追加
        if (line === '') {
            if (
                dat !== null &&
                dat.url !== undefined // URL必須
            ) {
                self._data.push(dat);
            };
            dat = null;
            return;
        };

        // 処理中データ初期化
        if (dat === null) {
            dat = {
                url: undefined,
                title: null,
                category: null,
                tags: null,
                comment: null,
                view: null
            };
        };

        // 以下、データ各値の取得処理
        // ! まとめられそうだけど、元データ上のキーとdatのキーが同じにならんかもなので
        //   一旦このままにしとく
        var m = null;
        // URL
        m = /^url=(.+)$/.exec(line);
        if (m !== null && m.length > 0) {
            dat.url = m[1];
            return;
        };
        // タイトル
        m = /^title=(.+)$/.exec(line);
        if (m !== null && m.length > 0) {
            dat.title = m[1];
            return;
        };
        // カテゴリ
        m = /^category=(.+)$/.exec(line);
        if (m !== null && m.length > 0) {
            dat.category = m[1];
            return;
        };
        // タグリスト
        m = /^tags=(.+)$/.exec(line);
        if (m !== null && m.length > 0) {
            dat.tagsText = m[1];
            // 半角カンマとスペースいずれかで分割
            // まずは前後や連続しているセパレータの整理から行っている
            dat.tags = dat.tagsText.replace(/(^[, ]+|[, ]+$)/g, '').split(/[, ]+/);
            return;
        };
        // コメント
        m = /^comment=(.+)$/.exec(line);
        if (m !== null && m.length > 0) {
            dat.comment = m[1];
            return;
        };
    });
};

/** タグリストを抽出する */
cls.prototype._extractTags = function(){
    var self = this;
    var list = [];
    cls._each(this._data, function(nouse, dat){
        if (dat.tags === null) return;
        cls._each(dat.tags, function(nouse, tag){
            if (cls._inArray(tag, list)) return;
            list.push(tag);
        });
    });
    list.sort();
    return list;
};
/** タグデータを生成し設定する */
cls.prototype._setTagData = function(){
    var self = this;

    /** @taglabel を取得する */
    function _getTagLabel(tag){
        var label = null;// 初期値
        cls._each(self._settingData, function(nouse, dat){
            if (dat.settingName === 'taglabel' && tag === dat.args[0]) {
                label = dat.args[1];
                return false;
            };
        });
        return label;
    };
    /** @tagorder を取得する */
    function _getTagOrder(tag){
        var order = 99999999;// 初期値
        cls._each(self._settingData, function(nouse, dat){
            if (dat.settingName === 'tagorder' && tag === dat.args[0]) {
                order = ~~dat.args[1];
                return false;
            };
        });
        return order;
    };

    cls._each(this._extractTags(), function(nouse, tag){
        self._tagData[tag] = {
            isSelected: false,
            view: undefined,
            label: _getTagLabel(tag),
            order: _getTagOrder(tag)
        };
    });
};
/** タグデータをリストとして返す */
cls.prototype._getTagDataByList = function(){
    var list = [];
    cls._each(this._tagData, function(tag, dat){
        dat.tag = tag;
        list.push(dat);
    });
    //
    // ! Chromeなどのブラウザは、orderが設定してある場合に2次ソートが一部崩れる
    //
    // 2次ソート
    list.sort(function(a, b){
        if (a < b) {
            return -1;
        } else if (a > b) {
            return 1;
        };
        return 0;
    });
    // 1次ソート
    list.sort(function(a, b){
        if (a.order < b.order) {
            return -1;
        } else if (a.order > b.order) {
            return 1;
        };
        return 0;
    });
    return list;
};
/** 選択中タグリストを返す */
cls.prototype._getSelectedTags = function(){
    var list = [];
    cls._each(this._tagData, function(tag, dat){
        if (dat.isSelected) list.push(tag);
    });
    return list;
};

/** ビューを初期化する, __INITIALIZE でしないのは事前にデータを非同期で取得する必要があるため
    また、他のビューをここで生成しないのはgetViewをデータ取得前に出来るようにするため */
cls.prototype._initializeViews = function(){
    var self = this;

    // タグセレクタ
    cls._each(this._getTagDataByList(), function(nouse, dat){
        var tagView = $('<a />').addClass(cls.CSS_SELECTOR + '-tagbutton')
            .text(dat.label || dat.tag)
            .attr({ href: 'javascript:void(0);' })
        ;
        tagView.bind('mousedown', {self:self, dat:dat}, function(evt){
            var self = evt.data.self;
            var dat = evt.data.dat;
            dat.isSelected = !dat.isSelected;
            self._draw();
        });
        //! &shy; は Firefoxで自動改行されないための対策
        // ref) http://d.hatena.ne.jp/cos31/20080929/firefox_word_break2
        //! ただし、これを使うと Chrome で行末のかなり以前で改行してしまう
        //  この点未調査だが、結局半角空白でやることにした
        //  なお、全角空白や&nbsp;だと何かしらのブラウザでNG
        self._tagSelectorView.append(tagView).append(
            $('<span />').text(' ').addClass(cls.CSS_SELECTOR + '-linebreaker')
        );
        //self._tagSelectorView.append(tagView).append(
        //    $('<span />').html('&shy;')
        //);
        dat.view = tagView;
    });
};

/** 描画する */
cls.prototype._draw = function(){
    var self = this;

    // タグセレクタ
    cls._each(this._tagData, function(nouse, dat){
        var selector = cls.CSS_SELECTOR + '-selectedtag';
        if (dat.isSelected) {
            dat.view.addClass(selector);
        } else {
            dat.view.removeClass(selector);
        };
    });

    // リスト
    this._linkListView.empty();
    var selectedTags = this._getSelectedTags();
    cls._each(this._data, function(nouse, dat){
        if (
            selectedTags.length === 0 ||
            dat.tags !== null && cls._allInArray(selectedTags, dat.tags)
        ) {
            self._linkListView.append(dat.view);
        };
    });
};

/** データから各リンクのビューリストを生成する */
cls.prototype._createLinkViews = function(){
    var self = this;
    cls._each(this._data, function(nouse, dat){
        dat.view = self._createLinkView(dat);
    });
};
/** 1行分のビューを生成する, dat obj 1行分のリンクデータ */
cls.prototype._createLinkView = function(dat){
    var self = this;
    // 行の枠
    var frame = $('<div />').addClass(cls.CSS_SELECTOR + '-link');
    // リンクになっているタイトル
    var title = $('<a />').addClass(cls.CSS_SELECTOR + '-title').attr({
        href: cls._escape(dat.url),
        target: '_blank'
    }).text(dat.title || dat.url);// タイトル無しはURLそのまま
    frame.append(title);
    // タグリスト
    var tags;
    if (dat.tags !== null) {
        tags = $('<span />').addClass(cls.CSS_SELECTOR + '-tags');
        cls._each(dat.tags, function(nouse, tag){
            var tagText = self._tagData[tag].label || tag;
            $('<span />').addClass(cls.CSS_SELECTOR + '-tag').text(tagText).appendTo(tags);
        });
        frame.append(tags);
    };
    // コメント
    var comment;
    if (dat.comment !== null) {
        $('<span />').addClass(cls.CSS_SELECTOR + '-comment').text(dat.comment)
            .appendTo(frame);
    };
    return frame;
};


/**
 * options:
 */
cls.factory = function(url, options){
    var opts = options || {};
    var obj = new this();
    obj._sourceUrl = url;
    //if ('sourceType' in opts) obj._sourceType = opts.sourceType;
    __INITIALIZE(obj);
    return obj;
};


// 定数群
cls.VERSION = '1.0.0.1';
cls.RELEASED_AT = '2012-05-15 12:00:00';


// 汎用関数群
cls.consoleLog = function(){
    if ('console' in __classScope__ && 'log' in __classScope__.console) {
        try {
            return __classScope__.console.log.apply(__classScope__.console, arguments);
        } catch (err) {// For IE
            var args = Array.prototype.slice.apply(arguments);
            return __classScope__.console.log(args.join(' '));
        };
    };
};
cls._each = function(obj, callback) {
    var length = obj.length, name;
    if (length === undefined) {
        for (name in obj) {
            if (callback.call(obj[name], name, obj[name]) === false) { break };
        };
    } else {
        var i = 0;
        for ( ; i < length; ) {
            if (callback.call(obj[i], i, obj[i++]) === false) { break };
        };
    };
    return obj;
};
cls._escape = function(str){
    str = str.replace(/>/g, '&gt;');
    str = str.replace(/</g, '&lt;');
    str = str.replace(/&/g, '&amp;');
    str = str.replace(/"/g, '&quot;');
    str = str.replace(/'/g, '&#039;');
    return str;
};
cls._indexOf = function(target, arr){
    var i;
    for (i = 0; i < arr.length; i++) { if (target === arr[i]) return i; };
    return -1;
};
cls._inArray = function(target, arr) {
    return cls._indexOf(target, arr) !== -1;
};
cls._allInArray = function(targets, arr){// targetsが全部arr内に含まれているか
    var i;
    for (i = 0; i < targets.length; i++) {
        if (cls._inArray(targets[i], arr) === false) return false;
    };
    return true;
};


__classScope__['LinkCollection'] = cls;
})();
