require([
  "esri/intl",
  "esri/portal/Portal",
  "esri/identity/OAuthInfo",
  "esri/identity/IdentityManager",
  "esri/WebMap",
  "esri/views/MapView",
  "esri/widgets/Editor"
], function (
  intl, Portal, OAuthInfo, identityManager,
  WebMap, MapView, Editor
) {
  intl.setLocale("us");
  //&groupID=1ddb8599dc58407f9686ab4093261dee&applicationID=Sa4aa6rGeVfPJwqh&webmapID=ad93c213bfbd4f26aa61c618305e6929
  
  //パラメータの読み込み
  if (location.search.match(/groupID=(.*?)(&|$)/) == null|| location.search.match(/applicationID=(.*?)(&|$)/) == null || location.search.match(/webmapID=(.*?)(&|$)/) == null) {
    changeEnable(false);
    return;
  } else {
    changeEnable(true);
  }

  try {
    var groupId = location.search.match(/groupID=(.*?)(&|$)/)[1];
    var applicationId = location.search.match(/applicationID=(.*?)(&|$)/)[1];
    var webmapId = location.search.match(/webmapID=(.*?)(&|$)/)[1];

    //メインページリンクの変更
    var link = $("#mainpage_link").attr("href");
    $("#mainpage_link").attr("href", link + "?groupID=" + groupId);
    
    //認証情報の初期化
    var portalUrl =  "https://www.arcgis.com/sharing";
    var info = new OAuthInfo({
      appId: applicationId,
      popup: false
    });

    identityManager.registerOAuthInfos([info]);
    identityManager.getCredential(portalUrl);


    const webmap = new WebMap({
      portalItem: {
        id: webmapId
      }
    });

    const view = new MapView({
      container: "viewDiv",
      map: webmap
    });

    view.when(() => {
      //レイヤーの表示切替
      webmap.layers.find(value => value.title == "observatory_master").visible = false;
      webmap.layers.find(value => value.title == "materials_master").visible = true;
      webmap.layers.find(value => value.title == "materials_view").visible = false;
      webmap.layers.find(value => value.title == "flood_hazard_image").visible = false;
      webmap.layers.find(value => value.title == "flood_risk_image").visible = false;
      webmap.layers.find(value => value.title == "flood_hazard_alltime").visible = false;
      webmap.layers.find(value => value.title == "flood_risk_alltime").visible = false;
      
      var editLayer = webmap.layers.find(value => value.title == "materials_master");
      const editor = new Editor({
        view: view,
        layer: editLayer
      });
      view.ui.add(editor, "top-right");
    });

    webmap.load()
      .catch(function(error) {
      changeEnable(false);
    });
  } catch (e) {
    changeEnable(false);
  }

  function changeEnable(enable) {
    if (enable) {
      $("#mainDiv").show();
      $("#disableDiv").hide();
    } else {
      $("#mainDiv").hide();
      $("#disableDiv").show();
    }
  }
});