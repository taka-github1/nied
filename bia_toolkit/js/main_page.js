var config = null;
var application_id = null;
var magager_groupid = null;
var operatiing_viewer_url = null;
var operatiing_edit_url = null;
var materials_viewer_url = null;

require([
  "esri/request",
  "esri/portal/Portal",
  "esri/portal/PortalGroup",
  "esri/portal/PortalUser",
  "esri/portal/PortalItem",
  "esri/identity/OAuthInfo",
  "esri/identity/IdentityManager",
  "esri/WebMap",
  "esri/layers/FeatureLayer",
  "esri/rest/geoprocessor",
  "esri/request"
], function(
        esriRequest, Portal, PortalGroup, PortalUser, PortalItem, OAuthInfo, identityManager, WebMap, FeatureLayer, geoprocessor, esriRequest) {
  //グループIDの読み込み
  var param = location.search.match(/groupID=(.*?)(&|$)/);
  if (param != null) {
    $('#groupID').val(decodeURIComponent(param[1]));
  } else {
    $('#groupID').val("");
  }
  
  //configの読み込み
  var json_url = "bia_toolkit_settings.json";
  $.ajaxSetup({async: false});
  $.getJSON(json_url, function(json) {
    config = json;
  });
  $.ajaxSetup({async: true});
  
  //認証情報の初期化
  var portalUrl =  "https://www.arcgis.com/sharing";
  var info = new OAuthInfo({
    appId: config.application_id,
    popup: false
  });

  identityManager.registerOAuthInfos([info]);

  $('#sign-in').click(function() {
    identityManager.getCredential(portalUrl);
  });
  
  $('#sign-out').click(function() {
    identityManager.destroyCredentials();
    window.location.reload();
  });

  identityManager.checkSignInStatus(portalUrl).then(function() {
    displayForm();
  });

  async function displayForm() {
    
    var portal = new Portal();
    await portal.load();
    
    //トークンをセット
    config.token = identityManager.credentials[0].token;
    
    //グループに所属しているかのチェック
    var belongGroups = await portal.user.fetchGroups();
    const contentGroup = belongGroups.find((group) => {
      return (group.id === $('#groupID').val());
    });
    
    //必要なアイテムがグループに共有されているかチェック
    var exist_item = false;
    if (contentGroup != undefined) {
      for (var i = 0; i < config.content_items.length; i++) {
        var param  = {
          "query": "tags: " + config.content_items[i].tag
        }
        var contents = await contentGroup.queryItems(param);
        if (contents != undefined && contents.total == 1) {
          exist_item = true;
          config.content_items[i].id = contents.results[0].id;
          config.content_items[i].url = contents.results[0].url;
        } else {
          break;
        }
      }
    }
    
    var role = portal.user.role;

    if (contentGroup != undefined && exist_item == true && role != "org_admin1") {
      $("#sign-in").addClass("hidden");
      $("#sign-out").removeClass("hidden");
      $('.viewer').css('display', 'block');
      $('.manager').css('display', 'block');
    } else if (contentGroup != undefined && exist_item == true){
      $("#sign-in").addClass("hidden");
      $("#sign-out").removeClass("hidden");
      $('.viewer').css('display', 'block');
      $('.manager').css('display', 'hidden');
    } else {          
      identityManager.destroyCredentials();
      config = null;
      $("#sign-in").removeClass("hidden");
      $("#sign-out").addClass("hidden");
      $('.viewer').css('display', 'none');
      $('.manager').css('display', 'none');
      
      if (exist_item == false) {
        alert("指定されたグループに必要なアイテムがありません");
      } else {
        alert("システムを利用する権限がありません");
      }
      return;
    }

    enableAnalysis();
  }
  
  $('#bus-commuting-viewer').click(function() {
    var send_params = {
      "groupID": $('#groupID').val(),
      "applicationID": config.application_id,
      "webmapID": config.content_items.find(value => value.tag == "operatiing_webmap").id
    };
    page_transition(config.operatiing_viewer_url, send_params);
  });
  
  $('#staff-maintenance').click(function() {
    var send_params = {
      "groupID": $('#groupID').val(),
      "applicationID": config.application_id,
      "webmapID": config.content_items.find(value => value.tag == "operatiing_webmap").id
    };
    page_transition(config.operatiing_edit_url, send_params);
  });
  
  $('#bus-analysis').click(function() {
    startBusRouteAnalysis();
  });
  
  $('#supply-viewer').click(function() {
    var send_params = {
      "groupID": $('#groupID').val(),
      "applicationID": config.application_id,
      "webmapID": config.content_items.find(value => value.tag == "materials_webmap").id
    };
    page_transition(config.materials_viewer_url, send_params);
  });
  
  $('#supply-maintenance').click(function() {
    var send_params = {
      "groupID": $('#groupID').val(),
      "applicationID": config.application_id,
      "webmapID": config.content_items.find(value => value.tag == "materials_webmap").id
    };
    page_transition(config.materials_edit_url, send_params);
  });
  
  $('#supply-analysis').click(function() {
    startSuppyChainAnalysis();
  });
  
  async function enableAnalysis() {
    //WebマップからフィーチャのURLを取得
    var webmapId = config.content_items.find(value => value.tag == "operatiing_webmap").id;
    var webmapItem = new WebMap({
      portalItem: {
        id: webmapId
      }
    });
    await webmapItem.load();
    
    //バスルートレイヤーの取得
    var featureUrl = webmapItem.layers.items.find(value => value.title == "busroute_master").url;
    var layerId = webmapItem.layers.items.find(value => value.title == "busroute_master").layerId;
    const busroute_master_layer = new FeatureLayer({
      url: featureUrl + "/" + layerId
    });
    
    var query = busroute_master_layer.createQuery();
    query.where = "(EditDate > LASTANALYSISDAY or LASTANALYSISDAY is NULL)"; //最終更新日時＞最終解析日時
    query.returnGeometry = false;

    var response = await busroute_master_layer.queryFeatures(query);
    var features = response.features;
    
    if (features.length == 0) {
      $("#bus-analysis").prop('disabled', true);
    } else {
      $("#bus-analysis").prop('disabled', false);
    }
    
    webmapId = config.content_items.find(value => value.tag == "materials_webmap").id;
    webmapItem = new WebMap({
      portalItem: {
        id: webmapId
      }
    });
    await webmapItem.load();
    
    //サプライチェーンレイヤーの取得
    featureUrl = webmapItem.layers.items.find(value => value.title == "materials_master").url;
    layerId = webmapItem.layers.items.find(value => value.title == "materials_master").layerId;
    const materials_master_layer = new FeatureLayer({
      url: featureUrl + "/" + layerId
    });
    
    var query = materials_master_layer.createQuery();
    query.where = "(EditDate > LASTANALYSISDAY or LASTANALYSISDAY is NULL)"; //最終更新日時＞最終解析日時
    query.returnGeometry = false;

    response = await materials_master_layer.queryFeatures(query);
    features = response.features;
    
    if (features.length == 0) {
      $("#supply-analysis").prop('disabled', true);
    } else {
      $("#supply-analysis").prop('disabled', false);
    }
  }
  
  //バスルートの解析開始
  async function startBusRouteAnalysis() {
    if (config == null) return;
    
    //処理中、操作無効
    $("#mainDisableDiv").show();
    $("#runtingText").text("");
    
    var id_field = "ROUTE_ID";
    var oid_field = "OBJECTID";
    
    //WebマップからフィーチャのURLを取得
    var webmapId = config.content_items.find(value => value.tag == "operatiing_webmap").id;
    var webmapItem = new WebMap({
      portalItem: {
        id: webmapId
      }
    });
    await webmapItem.load();
    var availableUrl = webmapItem.tables.find(value => value.title == "busroute_available").url;
    var availableLayerId = webmapItem.tables.find(value => value.title == "busroute_available").layerId;
    var availableLayer_url = availableUrl + "/" + availableLayerId;
    
    //バスルートレイヤーの取得
    var featureUrl = webmapItem.layers.items.find(value => value.title == "busroute_master").url;
    var layerId = webmapItem.layers.items.find(value => value.title == "busroute_master").layerId;
    const busroute_master_layer = new FeatureLayer({
      url: featureUrl + "/" + layerId
    });
    
    var query = busroute_master_layer.createQuery();
    query.where = "(EditDate > LASTANALYSISDAY or LASTANALYSISDAY is NULL)"; //最終更新日時＞最終解析日時
    query.outFields = oid_field + ", " + id_field;
    query.orderByFields = id_field;
    query.returnGeometry = true;

    var response = await busroute_master_layer.queryFeatures(query);
    var features = response.features;
    
    var result = [];
    for(var i = 0; i< features.length; i++) {
      result.push({
        "oid": features[i].attributes[oid_field],
        "id": features[i].attributes[id_field],
        "paths": features[i].geometry.paths,
      });
    }
    
    if (result.length == 0) { 
      alert("更新対象のデータがありません");
      $("#mainDisableDiv").hide();
      return;
    }

    var busroute_master_layer_url = busroute_master_layer.url + "/" + busroute_master_layer.layerId;
    startGeometryAnalysis("busroute", availableLayer_url, busroute_master_layer_url, result, id_field);

    $("#bus-analysis").prop('disabled', true);
  }
  
  //サプライチェーンの解析開始
  async function startSuppyChainAnalysis() {
    if (config == null) return;
    
    //処理中、操作無効
    $("#mainDisableDiv").show();
    $("#runtingText").text("");
    
    var id_field = "BASE_ID";
    var oid_field = "OBJECTID";
    
    //WebマップからフィーチャのURLを取得
    var webmapId = config.content_items.find(value => value.tag == "materials_webmap").id;
    var webmapItem = new WebMap({
      portalItem: {
        id: webmapId
      }
    });
    await webmapItem.load();
    
    //サプライチェーンレイヤーの取得
    var featureUrl = webmapItem.layers.items.find(value => value.title == "materials_master").url;
    var layerId = webmapItem.layers.items.find(value => value.title == "materials_master").layerId;
    const materials_master_layer = new FeatureLayer({
      url: featureUrl + "/" + layerId
    });
    
    var query = materials_master_layer.createQuery();
    query.where = "(EditDate > LASTANALYSISDAY or LASTANALYSISDAY is NULL)"; //最終更新日時＞最終解析日時
    query.outFields = oid_field + ", " + id_field;
    query.orderByFields = id_field;
    query.returnGeometry = true;

    var response = await materials_master_layer.queryFeatures(query);
    var features = response.features;
    
    var result = [];
    for(var i = 0; i< features.length; i++) {
      result.push({
        "oid": features[i].attributes[oid_field],
        "id": features[i].attributes[id_field],
        "x": features[i].geometry.x,
        "y": features[i].geometry.y
      });
    }
    
    if (result.length == 0) { 
      alert("更新対象のデータがありません");
      $("#mainDisableDiv").hide();
      return;
    }
    
    var availableUrl = webmapItem.tables.find(value => value.title == "materials_available").url;
    var availableLayerId = webmapItem.tables.find(value => value.title == "materials_available").layerId;
    var availableLayer_url = availableUrl + "/" + availableLayerId;
    var materials_master_layer_url = materials_master_layer.url + "/" + materials_master_layer.layerId;
    startGeometryAnalysis("materials", availableLayer_url, materials_master_layer_url, result, id_field);
    
    $("#supply-analysis").prop('disabled', true);
  }
  
  //ジオメトリから可否データの解析
  async function startGeometryAnalysis(type, featureUrl, masterUrl, features, id_field) {
    var deleteFeaturesUrl = featureUrl + "/deleteFeatures";
    var addFeaturesUrl = featureUrl + "/addFeatures";
    var updateFeaturesUrl = masterUrl + "/" + "updateFeatures";
    
    var geoprocessUrl = config.pointAnalysis_url;
    
    if (type == "materials") {
      geoprocessUrl = config.pointAnalysis_url;
    } else if (type == "busroute") {
      geoprocessUrl = config.polylineAnalysis_url;
    }
    
    $("#runtingText").text("Running（0/" + features.length + "）");
    
    var complelteJobs = [];
    for(var i = 0; i< features.length; i++) {
      const params = {
        Inputs: "[" + JSON.stringify(features[i]) + "]",
        SpatialReference: "4326"
      };

      //SubmitJobの発行
      var jobInfo = await geoprocessor.submitJob(geoprocessUrl, params);
      const jobid = jobInfo.jobId;

      const options = {
        interval: 5000,
        statusCallback: (j) => {
          console.log("Job Status: ", j.jobStatus);
        }
      };

      //JOBの完了まで待機
      await jobInfo.waitForJobCompletion(options);
      var result = await jobInfo.fetchResultData("Result");
      
      //前回の解析結果を削除
      var where = id_field + " = " + features[i].id;
      await deleteFeatures(deleteFeaturesUrl, where);
      
      //解析結果を登録
      await addFeatures(type, addFeaturesUrl, result.value, id_field);
      
      //最終解析日時をマスターに登録
      await updateFeatures(updateFeaturesUrl, features[i].oid);
      
      $("#runtingText").text("Running（" + (i+1) + "/" + features.length + "）");
      
      //1件のみ
      //break;
    }
    
    //処理完了、操作有効
    $("#mainDisableDiv").hide();
    
    if (type == "busroute") {
      startBusStopAnalysis(features);
    }
  }
  
  async function startBusStopAnalysis(changeroutes) {
    
    //処理開始、操作無効
    $("#runtingText").text("");
    $("#mainDisableDiv").show();
    
    var webmapId = config.content_items.find(value => value.tag == "operatiing_webmap").id;
    var webmapItem = new WebMap({
      portalItem: {
        id: webmapId
      }
    });
    await webmapItem.load();
    var businfoUrl = webmapItem.tables.find(value => value.title == "businfo_master").url;
    var businfoLayerId = webmapItem.tables.find(value => value.title == "businfo_master").layerId;
    var businfoQueryUrl = businfoUrl + "/" + businfoLayerId + "/query";
    
    var routeAvailableUrl = webmapItem.tables.find(value => value.title == "busroute_available").url;
    var routeAvailableLayerId = webmapItem.tables.find(value => value.title == "busroute_available").layerId;
    var queryFeaturesUrl = routeAvailableUrl + "/" + routeAvailableLayerId +"/query";
    
    var stopAvailableUrl = webmapItem.tables.find(value => value.title == "busstop_available").url;
    var stopAvailableLayerId = webmapItem.tables.find(value => value.title == "busstop_available").layerId;
    var addFeaturesUrl = stopAvailableUrl + "/" + stopAvailableLayerId +"/addFeatures";
    
    var truncateFeaturesUrl = stopAvailableUrl.replace("rest/services", "rest/admin/services") + "/" + stopAvailableLayerId +"/truncate";

    //STOP AVAILABLEテーブルの切り捨て
    var tQuery = {
      'f': 'json',
      'token': config.token
    }
    var tResponse = await editRequest(truncateFeaturesUrl, tQuery);
    
    //BUS INFO テーブルの取得
    var iQuery = {
      'f': 'json',
      'where': "1=1",
      'returnDistinctValues': true,
      'outFields': 'ROUTE_ID, STOP_ID',
      'orderByFields': 'ROUTE_ID, STOP_ID',
      'token': config.token
    };
    var iResponse = await editRequest(businfoQueryUrl, iQuery);
    var iFeatures = iResponse["data"]["features"];
    
    var businfoTbl = [];
    for (var i = 0; i < iFeatures.length; i++) {
      var iAttributes = iFeatures[i]["attributes"];
      businfoTbl.push({
        "ROUTE_ID": iAttributes["ROUTE_ID"],
        "STOP_ID": iAttributes["STOP_ID"]
      });
    }
    
    //対象データを検索
    var gGuery = {
      'f': 'json',
      'where': '1=1', //全件対象
      'returnDistinctValues': true,
      'outFields': 'STORY_ID, OPERATINGDAY',
      'orderByFields': 'STORY_ID, OPERATINGDAY',
      'returnGeometry': false,
      'token': config.token
    };
    var gResponse = await editRequest(queryFeaturesUrl, gGuery);
    var gFeatures = gResponse["data"]["features"];
    
    for (var i = 0; i < gFeatures.length; i++) {
      var gAttributes = gFeatures[i]["attributes"];
      var STORY_ID = gAttributes["STORY_ID"];
      var date = new Date(gAttributes["OPERATINGDAY"]);
      var OPERATINGDAY = formatDate(date, "yyyy-MM-dd");
      
      $("#runtingText").text("Running StoryID:" + STORY_ID + " Day:" + OPERATINGDAY);
      
      var query = {
        'f': 'json',
        'where': "STORY_ID = " + STORY_ID + " and OPERATINGDAY = '" + OPERATINGDAY + "'",
        'outFields': 'ROUTE_ID',
        'orderByFields': 'ROUTE_ID',
        'returnGeometry': false,
        'token': config.token
      };
      var rResponse = await editRequest(queryFeaturesUrl, query);
      var rFeatures = rResponse["data"]["features"];
      
      var routes = [];
      for (var j = 0; j < rFeatures.length; j++) {
        var rAttributes = rFeatures[j]["attributes"];
        routes.push(rAttributes["ROUTE_ID"]);
      }

      var notanailableStops = businfoTbl.filter(function(value) {
        return routes.includes(value.ROUTE_ID);
      });

      //STOP AVAILABLEテーブルに追加
      var stopNotavailables = [];
      for (var k = 0; k < notanailableStops.length; k++) {
        stopNotavailables.push({
          "attributes": {
            "STORY_ID": STORY_ID,
            "OPERATINGDAY": OPERATINGDAY,
            "STOP_ID": notanailableStops[k]["STOP_ID"]
          }
        });
      }
      
      query = {
        'f': 'json',
        'features': JSON.stringify(stopNotavailables),
        'token': config.token
      };
      await editRequest(addFeaturesUrl, query);
    }
    
    //処理完了、操作有効
    $("#runtingText").text("");
    $("#mainDisableDiv").hide();
  }
  
  //可否データの一時削除
  async function deleteFeatures(url, where) {
    var query = {
      'f': 'json',
      'where': where,
      'token': config.token
    };
    editRequest(url, query);
  }

  //可否データの登録
  async function addFeatures(type, url, features, id_field) {
    
    var update_features = [];
    for (var i = 0; i < features.length; i++) {
      var attributes = {};
      attributes[id_field] = features[i]["id"];
      attributes["STORY_ID"] = features[i]["STORY_ID"];
      attributes["OPERATINGDAY"] = features[i]["OPERATINGDAY"];
      attributes["INUNDATION_DEPTH"] = features[i]["INUNDATION_DEPTH"];
      
      //バスルートで浸水閾値以下はレコードを登録しない
      if (type == "busroute" && features[i]["INUNDATION_DEPTH"] < 0.3) {
        continue;
      }
      if (features[i]["INUNDATION_DEPTH"] >= 0.3) {
        attributes["AVAILABLE"] = 1;
      }
      update_features.push({
        "attributes": attributes
      });
    }

    var query = {
      'f': 'json',
      'features': JSON.stringify(update_features),
      'token': config.token
    };
    editRequest(url, query);
  }
  
  //マスターデータの解析日時を更新 ※要フィールド追加
  async function updateFeatures(url, oid) {
    var now = new Date();
    var utc_time = now.getUTCFullYear() + "-" + (now.getUTCMonth() + 1) + "-" + now.getUTCDate() + " "
                      + now.getUTCHours() + ":" + (now.getUTCMinutes() + 1)  + ":" + now.getUTCSeconds();
    
    var update_features = [];
    var attributes = {};
    attributes["OBJECTID"] = oid;
    attributes["LASTANALYSISDAY"] = utc_time;
    update_features.push({
      "attributes": attributes
    });
    var query = {
      'f': 'json',
      'features': JSON.stringify(update_features),
      'token': config.token
    };
    editRequest(url, query);
  }
  
  //リクエスト送信
  async function editRequest(url, query) {
    var response = [];
    try {
      response = await esriRequest(url, {
        query: query,
        method: "post",
        responseType: "json"
      });
      
      //console.log(response);
    } catch (error) {
      console.log("error:" + error);
    }
    return response;
  }

  //設定をパラメータにセットしてページ遷移
  function page_transition(url, params) {
    const form = document.createElement('form');
    form.method = 'get';
    form.action = url;
    
    for (var key in params) {
      const hiddenField = document.createElement('input');
      hiddenField.type = 'hidden';
      hiddenField.name =  key;
      hiddenField.value = params[key];
      form.appendChild(hiddenField);
    }
    document.body.appendChild(form);
    form.submit();
  }
  
  //日付のフォーマット
  function formatDate(date, format) {
    format = format.replace(/yyyy/g, date.getFullYear());
    format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
    format = format.replace(/dd/g, ('0' + date.getDate()).slice(-2));
    format = format.replace(/HH/g, ('0' + date.getHours()).slice(-2));
    format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
    format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
    format = format.replace(/SSS/g, ('00' + date.getMilliseconds()).slice(-3));
    return format;
  }
});
