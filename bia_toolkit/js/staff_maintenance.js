require([
  "esri/intl",
  "esri/portal/Portal",
  "esri/identity/OAuthInfo",
  "esri/identity/IdentityManager",
  "esri/WebMap",
  "esri/layers/FeatureLayer",
  "esri/widgets/FeatureTable"
], function(
        intl, Portal, OAuthInfo, identityManager,
         WebMap, FeatureLayer, FeatureTable
        ) {
  intl.setLocale("us");
  
  //&groupID=1ddb8599dc58407f9686ab4093261dee&applicationID=Sa4aa6rGeVfPJwqh&webmapID=40caec6ef3e141adb25bf92d68adcf02

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

    var select_objectIds = [];
    var token, editLayer, table;

    webmap.load().then(function () {
      //トークンをセット
      token = identityManager.credentials[0].token;

      editLayer = webmap.tables.find(value => value.title == "staff_master");
      table = new FeatureTable({
        layer: editLayer,
        visibleElements: {selectionColumn: false},
        editingEnabled: true,
        pageSize: 10,
        visibleElements: {
          header: false,
          menu: false,
          menuItems: {
            clearSelection: false,
            refreshData: false,
            toggleColumns: false
          },
          selectionColumn: true
        },
        fieldConfigs: [
          {
            name: "STAFF_ID",
            label: "STAFF_ID",
            visible: true,
            direction: "asc"
          },
          {
            name: "NAME",
            label: "Name"
          },
          {
            name: "STAFF_SECTION",
            label: "STAFF_SECTION"
          },
          {
            name: "STAFF_POSITION",
            label: "STAFF_POSITION"
          },
          {
            name: "LEADER",
            label: "LEADER"
          },
          {
            name: "BUS_STOP_ID",
            label: "BUS_STOP_ID"
          }
        ],
        container: document.getElementById("tableDiv")
      });

      table.on("selection-change", function(changes) {
        changes.removed.forEach(function(item) {
          if (item.objectId) {
            select_objectIds.splice(select_objectIds.indexOf(item.objectId), 1);
          }
        });

        changes.added.forEach(function(item) {
          if (item.objectId) {
            select_objectIds.push(item.objectId);
          }
        });
      });
    });
  } catch (e) {
    changeEnable(false);
  }


  //CSV読み込み
  $('#btn-csv-select').click(function(e){
    $('#csv-select').click();
  });

  //全選択
  $('#btn-all-select').click(function(e){
    selectFeatures(0);
  });

  //全選択解除
  $('#btn-clear-select').click(function(e){
    selectFeatures(1);
  });

  //選択削除
  $('#btn-delete-select').click(function(e){
    deleteSelectionFeatures();
  });


  var csv_select = document.getElementById("csv-select");
  csv_select.addEventListener('change', function(e) {
    var fileData = e.target.files[0];
    var reader = new FileReader();
    reader.onerror = function() {
      alert('ファイル読み取りに失敗しました')
    }

    reader.onload = function() {
      var lineArr = reader.result.split("\r\n");
      var itemArr = [];
      for (var i = 0; i < lineArr.length; i++) {
        itemArr[i] = lineArr[i].split(",");
      }

      if (input_csv_check(itemArr) == false){
        return;
      } 
      addFeatures(itemArr);
    }

    reader.readAsText(fileData);
  });

  function input_csv_check(data) {
    var result = false;

    //CSVのフィールド存在チェック
    var allow_fields = table.fieldConfigs;
    var input_fields = data[0];
    var field_exists_check = true;
    for (var i = 0; i < input_fields.length; i++) {
      var hit_field = allow_fields.find(key => key.name == input_fields[i]);

      if (hit_field == null) {
        field_exists_check = false;
      }
    }

    if (field_exists_check == false) {
      alert("ERROR: FIELD NOT EXISTS");
      return false;
    }

    return true;
  }

  function addFeatures(data) {
    var features = [];
    var input_fields = data[0];
    for (var i = 1; i < data.length; i++) {
      var attribute = {};
      if (data[i].length <= 1){
        continue;
      }
      for (var j = 0; j < data[i].length; j++) {
        var field = data[0][j];
        var value = data[i][j];  
        attribute[field] = value;
      }
      features.push({
        "attributes": attribute
      });
    }

    var url = editLayer.url + "/" + editLayer.layerId + "/addFeatures";
    var form = new FormData();
    form.set('f','json');
    form.set('features', JSON.stringify(features));
    form.set('token', token);

    $.ajax({
      url: url,
      type: "POST",
      data: form,
      processData: false,
      contentType: false,
      dataType: 'json',
      async: false
    }).done(function(data) {
      console.log(data);
      table.refresh(); 
    }).fail(function(data) {
      console.log(data);
    });
  }

  
  async function selectFeatures(flg) {
    var query = editLayer.createQuery();
    query.where = "1=1";
    query.outFields = "*";

    var response = await editLayer.queryFeatures(query);
    var features = response.features;

    if (flg==0) {
      table.selectRows(features);
    } else {
      table.deselectRows(features);
    }
  }

  async function deleteSelectionFeatures() {
    var deleteFeatures = [];
    for (var i=0;i<select_objectIds.length;i++){
      deleteFeatures.push({objectId: select_objectIds[i]});
    }

    if (select_objectIds.length > 0){
      await editLayer.applyEdits({
        deleteFeatures: deleteFeatures
      });
      table.refresh();  
    }
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